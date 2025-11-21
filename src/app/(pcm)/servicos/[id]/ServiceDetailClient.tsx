"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { ArrowLeft, Pencil } from "lucide-react";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  type FirestoreError,
} from "firebase/firestore";
import SCurveDeferred from "@/components/SCurveDeferred";
import { plannedCurve } from "@/lib/curve";
import { resolveServicoPercentualPlanejado } from "@/lib/serviceProgress";
import { isFirestoreLongPollingForced, tryGetFirestore } from "@/lib/firebase";
import { isConnectionResetError } from "@/lib/networkErrors";
import { useFirebaseAuthSession } from "@/lib/useFirebaseAuthSession";
import type { ChecklistItem, Service, ServiceUpdate } from "@/lib/types";
import {
  ServiceRealtimeData,
  buildRealizedSeries,
  computeTimeWindowHours,
  composeServiceRealtimeData,
  deriveRealizedPercent,
  formatDate,
  formatDateTime,
  formatUpdateSummary,
  mapChecklistSnapshot,
  mapServiceSnapshot,
  mapUpdateSnapshot,
  mergeServiceRealtime,
  normaliseStatus,
  toNewChecklist,
  toNewUpdates,
} from "./shared";

const DeleteServiceButton = dynamic(() => import("@/components/DeleteServiceButton"), {
  ssr: false,
  loading: () => (
    <button type="button" className="btn btn-destructive" disabled>
      Carregando...
    </button>
  ),
});

const CONNECTION_RESET_FRIENDLY_MESSAGE =
  "A conexão com os serviços do Firebase foi resetada. Tentaremos reconectar automaticamente. Caso o problema persista, libere o acesso a firestore.googleapis.com e identitytoolkit.googleapis.com no firewall/proxy.";

type ServiceDetailClientProps = {
  serviceId: string;
  baseService: ServiceRealtimeData;
  fallbackService?: ServiceRealtimeData | null;
  initialChecklist: ChecklistItem[];
  initialUpdates: ServiceUpdate[];
  initialPlanned: Array<{ date: string; percent: number; hoursAccum?: number }>;
  initialRealizedSeries: Array<{ date: string; percent: number }>;
  initialRealizedPercent: number;
  latestToken: { code: string; company?: string | null } | null;
  tokenLink: string | null;
};

type ServiceFallbackSuccess = {
  ok: true;
  service: Service | null;
  legacyService: Service | null;
  checklist: ChecklistItem[];
  updates: ServiceUpdate[];
  latestToken: ServiceDetailClientProps["latestToken"];
};

type ServiceFallbackError = { ok: false; error?: string };

export default function ServiceDetailClient({
  serviceId,
  baseService,
  fallbackService,
  initialChecklist,
  initialUpdates,
  initialPlanned,
  initialRealizedSeries,
  initialRealizedPercent,
  latestToken,
  tokenLink,
}: ServiceDetailClientProps) {
  const composedInitial = useMemo(
    () => composeServiceRealtimeData(baseService, fallbackService ?? undefined),
    [baseService, fallbackService],
  );
  const encodedServiceId = encodeURIComponent(serviceId);
  const searchParams = useSearchParams();
  const isPdfExport = searchParams?.get("export") === "pdf";
  const resolvedChartHeight = isPdfExport ? 480 : 288;

  const [service, setService] = useState<ServiceRealtimeData>(composedInitial);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(toNewChecklist(initialChecklist));
  const [updates, setUpdates] = useState<ServiceUpdate[]>(toNewUpdates(initialUpdates));
  const [connectionIssue, setConnectionIssue] = useState<string | null>(null);
  const [currentToken, setCurrentToken] = useState<ServiceDetailClientProps["latestToken"]>(latestToken);
  const [currentTokenLink, setCurrentTokenLink] = useState<string | null>(tokenLink);
  const normalizedInitialUpdates = useMemo(() => toNewUpdates(initialUpdates), [initialUpdates]);
  const longPollingForced = isFirestoreLongPollingForced;
  const { ready: isAuthReady, issue: authIssue, user } = useFirebaseAuthSession();
  const latestIdTokenRef = useRef<string | null>(null);
  const retryTimeoutRef = useRef<number | null>(null);
  const [shouldListenToSecondaryRealtime, setShouldListenToSecondaryRealtime] = useState(false);

  useEffect(() => {
    setCurrentToken(latestToken);
    setCurrentTokenLink(tokenLink);
  }, [latestToken, tokenLink]);

  useEffect(() => {
    if (shouldListenToSecondaryRealtime) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }

    let activated = false;
    const activate = () => {
      if (activated) {
        return;
      }
      activated = true;
      setShouldListenToSecondaryRealtime(true);
    };

    const timeoutId = window.setTimeout(activate, 1500);
    const handlePointerDown = () => activate();
    const handleKeyDown = () => activate();
    const handleScroll = () => activate();

    window.addEventListener("pointerdown", handlePointerDown, { once: true });
    window.addEventListener("keydown", handleKeyDown, { once: true });
    window.addEventListener("scroll", handleScroll, { once: true, passive: true });

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [shouldListenToSecondaryRealtime]);

  useEffect(() => {
    let cancelled = false;
    const unsubscribers: Array<() => void> = [];
    let fallbackRunning = false;

    const clearRealtimeListeners = () => {
      while (unsubscribers.length) {
        const unsubscribe = unsubscribers.pop();
        if (!unsubscribe) continue;
        try {
          unsubscribe();
        } catch (unsubscribeError) {
          console.warn("[service-detail] Falha ao cancelar listener", unsubscribeError);
        }
      }
    };

    const scheduleReconnect = (reason: string) => {
      if (cancelled) return;
      if (retryTimeoutRef.current !== null) return;
      const delayMs = 4000;
      console.info(
        `[service-detail] Tentando reconectar ao Firestore em ${delayMs}ms (motivo: ${reason}).`,
      );
      retryTimeoutRef.current = window.setTimeout(() => {
        retryTimeoutRef.current = null;
        if (cancelled) return;
        clearRealtimeListeners();
        void bootstrapRealtime(true);
      }, delayMs);
    };

    const fetchFallbackFromServer = async (options?: { message?: string }) => {
      if (fallbackRunning) return;
      fallbackRunning = true;
      try {
        let tokenCandidate = latestIdTokenRef.current;
        if (!tokenCandidate && user) {
          try {
            tokenCandidate = await user.getIdToken();
            latestIdTokenRef.current = tokenCandidate;
          } catch {
            tokenCandidate = null;
          }
        }
        const headers: HeadersInit = tokenCandidate
          ? { Authorization: `Bearer ${tokenCandidate}` }
          : {};
        const response = await fetch(`/api/pcm/servicos/${encodedServiceId}/fallback`, {
          headers,
          cache: "no-store",
        });
        const json = (await response.json().catch(() => null)) as
          | ServiceFallbackSuccess
          | ServiceFallbackError
          | null;

        if (cancelled) {
          return;
        }

        if (!response.ok || !json || json.ok !== true) {
          const reason = json && json.ok === false ? json.error : response.statusText;
          console.warn(`[service-detail] Fallback indisponível para ${serviceId}`, {
            status: response.status,
            reason,
          });
          return;
        }

        const composed = composeServiceRealtimeData(json.service, json.legacyService ?? undefined);
        setService((current) => mergeServiceRealtime(current, composed));
        setChecklist(toNewChecklist(json.checklist ?? []));
        setUpdates(toNewUpdates(json.updates ?? []));
        setCurrentToken(json.latestToken ?? null);
        setCurrentTokenLink(
          json.latestToken ? `/acesso?token=${encodeURIComponent(json.latestToken.code)}` : null,
        );
        setConnectionIssue(
          options?.message ??
            "Sincronização em tempo real não disponível; exibindo dados atualizados do servidor.",
        );
      } catch (error) {
        if (cancelled) return;
        if (isConnectionResetError(error)) {
          console.warn(
            `[service-detail] Fallback indisponível devido a ERR_CONNECTION_RESET (${serviceId})`,
            error,
          );
          setConnectionIssue(CONNECTION_RESET_FRIENDLY_MESSAGE);
          scheduleReconnect("fallback-connection-reset");
        } else {
          console.error(
            `[service-detail] Falha ao carregar fallback do serviço ${serviceId}`,
            error,
          );
        }
      } finally {
        fallbackRunning = false;
      }
    };

    async function bootstrapRealtime(isRetry = false) {
      if (!isAuthReady || !user) {
        setConnectionIssue(null);
        return;
      }

      try {
        const token = await user.getIdToken();
        if (cancelled) return;
        latestIdTokenRef.current = token;
      } catch (tokenError) {
        if (cancelled) return;
        if (isConnectionResetError(tokenError)) {
          console.warn(
            `[service-detail] ERR_CONNECTION_RESET ao obter idToken para ${serviceId}`,
            tokenError,
          );
          setConnectionIssue(CONNECTION_RESET_FRIENDLY_MESSAGE);
          scheduleReconnect("auth-connection-reset");
        } else {
          console.error(
            `[service-detail] Falha ao obter idToken antes de iniciar listeners do serviço ${serviceId}`,
            tokenError,
          );
          setConnectionIssue(
            "Não foi possível validar sua sessão segura. Atualize a página ou faça login novamente.",
          );
        }
        return;
      }

      const { db, error } = tryGetFirestore();
      if (!db) {
        if (error) {
          console.warn("[service-detail] Firestore indisponível", error);
        }
        const hint = longPollingForced
          ? "Conexão com o Firestore indisponível. Continuaremos tentando via long-polling."
          : "Conexão indisponível. Considere ativar long-polling.";
        setConnectionIssue(hint);
        return;
      }

      const serviceRef = doc(db, "services", serviceId);

      const handleError = (firestoreError: FirestoreError) => {
        if (cancelled) return;
        if (firestoreError.code === "permission-denied") {
          console.warn(
            `[service-detail] Usuário sem permissão para sincronização em tempo real do serviço ${serviceId}`,
            firestoreError,
          );
          setConnectionIssue("Sincronização em tempo real não disponível para este usuário.");
          void fetchFallbackFromServer();
          return;
        }

        if (isConnectionResetError(firestoreError)) {
          console.warn(
            `[service-detail] Listener interrompido por ERR_CONNECTION_RESET (${serviceId})`,
            firestoreError,
          );
          setConnectionIssue(CONNECTION_RESET_FRIENDLY_MESSAGE);
          void fetchFallbackFromServer({ message: CONNECTION_RESET_FRIENDLY_MESSAGE });
          scheduleReconnect("firestore-connection-reset");
          return;
        }

        const message =
          firestoreError.code === "unavailable"
            ? longPollingForced
              ? "Conexão com o Firestore indisponível. Continuaremos tentando via long-polling."
              : "Conexão indisponível. Considere ativar long-polling."
            : "Não foi possível sincronizar com o Firestore. Tentaremos novamente.";
        console.warn(`[service-detail] Falha na escuta do serviço ${serviceId}`, firestoreError);
        setConnectionIssue(message);
        if (firestoreError.code === "unavailable") {
          scheduleReconnect("firestore-unavailable");
        }
      };

      if (isRetry) {
        clearRealtimeListeners();
      }

      unsubscribers.push(
        onSnapshot(
          serviceRef,
          (snapshot) => {
            if (cancelled) return;
            const mapped = mapServiceSnapshot(snapshot);
            setService((current) => mergeServiceRealtime(current, mapped));
            setConnectionIssue(null);
            if (retryTimeoutRef.current !== null) {
              clearTimeout(retryTimeoutRef.current);
              retryTimeoutRef.current = null;
            }
          },
          handleError,
        ),
      );

      if (shouldListenToSecondaryRealtime) {
        unsubscribers.push(
          onSnapshot(
            query(collection(serviceRef, "updates"), orderBy("createdAt", "desc"), limit(100)),
            (snapshot) => {
              if (cancelled) return;
              const mapped = snapshot.docs.map((docSnap) => mapUpdateSnapshot(docSnap));
              setUpdates(toNewUpdates(mapped));
              setConnectionIssue(null);
              if (retryTimeoutRef.current !== null) {
                clearTimeout(retryTimeoutRef.current);
                retryTimeoutRef.current = null;
              }
            },
            handleError,
          ),
        );

        unsubscribers.push(
          onSnapshot(
            query(collection(serviceRef, "checklist"), orderBy("description", "asc")),
            (snapshot) => {
              if (cancelled) return;
              const mapped = snapshot.docs.map((docSnap) => mapChecklistSnapshot(docSnap));
              setChecklist(toNewChecklist(mapped));
              setConnectionIssue(null);
              if (retryTimeoutRef.current !== null) {
                clearTimeout(retryTimeoutRef.current);
                retryTimeoutRef.current = null;
              }
            },
            handleError,
          ),
        );
      }
    }

    void bootstrapRealtime();

    return () => {
      cancelled = true;
      clearRealtimeListeners();
      if (retryTimeoutRef.current !== null) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [
    serviceId,
    longPollingForced,
    isAuthReady,
    user,
    shouldListenToSecondaryRealtime,
  ]);

  const planned = useMemo(() => {
    const start = service.plannedStart ?? composedInitial.plannedStart;
    const end = service.plannedEnd ?? composedInitial.plannedEnd;
    const totalHoursCandidate =
      typeof service.totalHours === "number" && Number.isFinite(service.totalHours)
        ? service.totalHours
        : typeof composedInitial.totalHours === "number"
          ? composedInitial.totalHours
          : null;
    if (!start || !end || !totalHoursCandidate) {
      return initialPlanned;
    }
    try {
      return plannedCurve(start, end, totalHoursCandidate > 0 ? totalHoursCandidate : 1);
    } catch (error) {
      console.warn("[service-detail] Falha ao recalcular curva planejada", error);
      return initialPlanned;
    }
  }, [
    service.plannedStart,
    composedInitial.plannedStart,
    service.plannedEnd,
    composedInitial.plannedEnd,
    service.totalHours,
    composedInitial.totalHours,
    initialPlanned,
  ]);

  const realizedPercent = useMemo(() => {
    try {
      return deriveRealizedPercent(service, checklist, updates);
    } catch (error) {
      console.warn("[service-detail] Falha ao calcular andamento realizado", error);
      return initialRealizedPercent;
    }
  }, [service, checklist, updates, initialRealizedPercent]);

  const realizedSeries = useMemo(() => {
    try {
      return buildRealizedSeries({
        updates,
        planned,
        realizedPercent,
        plannedStart: service.plannedStart ?? composedInitial.plannedStart,
        plannedEnd: service.plannedEnd ?? composedInitial.plannedEnd,
        createdAt: service.createdAt ?? composedInitial.createdAt ?? null,
      });
    } catch (error) {
      console.warn("[service-detail] Falha ao recalcular série realizada", error);
      return initialRealizedSeries;
    }
  }, [
    updates,
    planned,
    realizedPercent,
    service.plannedStart,
    composedInitial.plannedStart,
    service.plannedEnd,
    composedInitial.plannedEnd,
    service.createdAt,
    composedInitial.createdAt,
    initialRealizedSeries,
  ]);

  const serviceLabel = useMemo(() => {
    if (service.os && service.os.trim()) return service.os;
    if (service.code && service.code.trim()) return service.code;
    return service.id;
  }, [service.id, service.os, service.code]);

  const plannedPercentToDate = useMemo(() => {
    const today = new Date();
    return resolveServicoPercentualPlanejado({
      ...service,
      plannedStart: service.plannedStart ?? composedInitial.plannedStart,
      plannedEnd: service.plannedEnd ?? composedInitial.plannedEnd,
    }, today);
  }, [service, composedInitial]);

  const companyLabel = useMemo(() => {
    if (service.assignedTo?.companyName) return service.assignedTo.companyName;
    if (service.assignedTo?.companyId) return service.assignedTo.companyId;
    if (service.company) return service.company;
    if (service.empresa) return service.empresa;
    return null;
  }, [service.assignedTo, service.company, service.empresa]);

  const statusLabel = useMemo(() => normaliseStatus(service.status), [service.status]);

  const displayedUpdates = useMemo(() => {
    if (updates.length === 0) {
      return normalizedInitialUpdates;
    }
    return updates;
  }, [updates, normalizedInitialUpdates]);

  const recentChecklist = useMemo(
    () =>
      [...checklist].sort((a, b) => {
        const left = typeof a.updatedAt === "number" ? a.updatedAt : 0;
        const right = typeof b.updatedAt === "number" ? b.updatedAt : 0;
        return right - left;
      }),
    [checklist],
  );

  const handleExportPdf = useCallback(() => {
    // Use the native print dialog to allow exporting the full report as PDF.
    if (typeof window === "undefined") return;
    window.print();
  }, []);

  return (
    <div className="container mx-auto space-y-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Serviço {serviceLabel}</h1>
          <p className="text-sm text-muted-foreground">
            Visão geral, andamento e curva S do serviço selecionado.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="btn btn-secondary" href="/dashboard">
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Voltar
          </Link>
          <Link
            className="btn btn-primary"
            href={`/servicos/${encodeURIComponent(service.id)}/editar`}
          >
            <Pencil aria-hidden="true" className="h-4 w-4" />
            Editar
          </Link>
          <button type="button" className="btn btn-outline" onClick={handleExportPdf}>
            Exportar PDF
          </button>
          <DeleteServiceButton serviceId={service.id} serviceLabel={serviceLabel} />
        </div>
      </div>

      {authIssue || connectionIssue ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
          {authIssue ?? connectionIssue}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_minmax(320px,380px)]">
        <div className="card p-4">
          <h2 className="mb-4 text-lg font-semibold">Informações gerais</h2>
          <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="font-medium">{statusLabel}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Andamento</dt>
              <dd className="font-medium">{Math.round(realizedPercent)}%</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Tag</dt>
              <dd className="font-medium">{service.tag || "-"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Equipamento</dt>
              <dd className="font-medium">{service.equipmentName || "-"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Setor</dt>
              <dd className="font-medium">{service.setor || service.sector || "-"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Empresa atribuída</dt>
              <dd className="font-medium">{companyLabel || "-"}</dd>
            </div>
          <div>
            <dt className="text-muted-foreground">Horas Totais</dt>
            <dd className="font-medium">
              {typeof service.totalHours === "number" && Number.isFinite(service.totalHours)
                ? service.totalHours
                : "-"}
            </dd>
          </div>
          <div className="hide-for-print">
            <dt className="text-muted-foreground">Início planejado</dt>
            <dd className="font-medium">
              {formatDate(service.plannedStart ?? composedInitial.plannedStart ?? null)}
            </dd>
          </div>
          <div className="hide-for-print">
            <dt className="text-muted-foreground">Fim planejado</dt>
            <dd className="font-medium">
              {formatDate(service.plannedEnd ?? composedInitial.plannedEnd ?? null)}
            </dd>
          </div>
          <div className="hide-for-print">
            <dt className="text-muted-foreground">Última atualização</dt>
            <dd className="font-medium">
              {formatDateTime(service.updatedAt ?? composedInitial.updatedAt ?? null)}
            </dd>
          </div>
          <div className="sm:col-span-2 hide-for-print">
            <dt className="text-muted-foreground">Token de acesso</dt>
            <dd className="space-y-3">
              {currentToken ? (
                  <div className="space-y-2">
                    <div className="inline-flex items-center rounded-md border border-primary/40 bg-primary/10 px-2 py-1 font-mono text-sm text-primary">
                      {currentToken.code}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {currentToken.company ? <span>Empresa vinculada: {currentToken.company}</span> : null}
                      {currentTokenLink ? (
                        <Link className="link text-xs" href={currentTokenLink} target="_blank" rel="noreferrer">
                          Abrir link público
                        </Link>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Nenhum token ativo</span>
                )}
                <p className="text-xs text-muted-foreground">
                  O token é gerado automaticamente ao cadastrar o serviço.
                </p>
              </dd>
            </div>
          </dl>
        </div>
        <SCurveDeferred
        planned={planned}
        realizedSeries={realizedSeries}
        realizedPercent={realizedPercent}
          title="Curva S do serviço"
          description="Evolução planejada versus realizado para este serviço."
          headerAside={<span className="font-medium text-foreground">Realizado: {realizedPercent}%</span>}
          metrics={{ plannedToDate: plannedPercentToDate }}
          chartHeight={resolvedChartHeight}
          deferRendering={!isPdfExport}
          fallback={
            <div
              className="flex w-full items-center justify-center rounded-xl border border-dashed bg-muted/40"
              style={{ minHeight: resolvedChartHeight }}
            >
              <span className="text-sm text-muted-foreground">Carregando gráfico...</span>
            </div>
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">Checklists Recentes</h2>
            <span className="text-xs text-muted-foreground">Serviço {serviceLabel}</span>
          </div>
          {recentChecklist.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Nenhum checklist cadastrado.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {recentChecklist.map((item) => (
                <li key={item.id} className="space-y-2 rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{item.description}</span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(item.updatedAt)}</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      Status: {item.status === "em-andamento" ? "Em andamento" : item.status === "concluido" ? "Concluído" : "Não iniciado"}
                    </span>
                    <span className="text-sm font-semibold text-primary">{Math.round(item.progress)}%</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-4">
          <h2 className="text-lg font-semibold">Atualizações recentes</h2>
          {displayedUpdates.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Nenhuma atualização registrada.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {displayedUpdates.slice(0, 6).map((update) => {
                const summary = formatUpdateSummary(update);
                const hours = computeTimeWindowHours(update);
                return (
                  <li key={update.id} className="space-y-2 rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-base font-semibold text-foreground">{summary.title}</span>
                      <span className="text-sm font-semibold text-primary">{summary.percentLabel}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Atualizado em {formatDateTime(update.createdAt)}</p>
                    {update.subactivity?.label ? (
                      <p className="text-xs text-muted-foreground">
                        Subatividade: <span className="font-medium text-foreground">{update.subactivity.label}</span>
                      </p>
                    ) : null}
                    {summary.description ? <p className="text-sm text-foreground">{summary.description}</p> : null}
                    {summary.resources ? (
                      <p className="text-xs text-muted-foreground">Recursos: {summary.resources}</p>
                    ) : null}
                    {summary.hoursLabel ? (
                      <p className="text-xs text-muted-foreground">{summary.hoursLabel}</p>
                    ) : null}
                    {hours === null && update.timeWindow?.start && update.timeWindow?.end ? (
                      <p className="text-xs text-muted-foreground">
                        Período: {formatDateTime(update.timeWindow.start)} → {formatDateTime(update.timeWindow.end)}
                      </p>
                    ) : null}
                    {update.impediments && update.impediments.length > 0 ? (
                      <div className="text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">Impedimentos:</span>
                        <ul className="mt-1 space-y-1">
                          {update.impediments.map((item, index) => (
                            <li key={index}>
                              {item.type}
                              {item.durationHours !== null && item.durationHours !== undefined
                                ? ` • ${item.durationHours}h`
                                : ""}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {update.workforce && update.workforce.length > 0 ? (
                      <div className="text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">Mão de obra:</span>
                        <ul className="mt-1 space-y-1">
                          {update.workforce.map((item, index) => (
                            <li key={index}>
                              {item.role}
                              {item.quantity
                                ? ` • ${item.quantity} ${item.quantity === 1 ? "profissional" : "profissionais"}`
                                : ""}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {update.shiftConditions && update.shiftConditions.length > 0 ? (
                      <div className="text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">Condições por turno:</span>
                        <ul className="mt-1 space-y-1">
                          {update.shiftConditions.map((item, index) => (
                            <li key={index}>
                              {item.shift}
                              {item.weather ? ` • ${item.weather}` : ""}
                              {item.condition ? ` • ${item.condition}` : ""}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {update.evidences && update.evidences.length > 0 ? (
                      <div className="text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">Evidências:</span>
                        <ul className="mt-1 space-y-1">
                          {update.evidences.map((item, index) => (
                            <li key={index}>
                              <a href={item.url} target="_blank" rel="noreferrer" className="text-primary underline">
                                {item.label || item.url}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {update.justification ? (
                      <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                        Justificativa: {update.justification}
                      </div>
                    ) : null}
                    {typeof update.criticality === "number" ? (
                      <p className="text-xs text-muted-foreground">Criticidade observada: {update.criticality}/5</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
