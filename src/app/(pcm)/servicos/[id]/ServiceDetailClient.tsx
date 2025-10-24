"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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

import SCurve from "@/components/SCurve";
import DeleteServiceButton from "@/components/DeleteServiceButton";
import { plannedCurve } from "@/lib/curve";
import { tryGetFirestore } from "@/lib/firebase";
import type { ChecklistItem, ServiceUpdate } from "@/lib/types";
import {
  ServiceRealtimeData,
  buildRealizedSeries,
  computeTimeWindowHours,
  composeServiceRealtimeData,
  deriveRealizedPercent,
  formatDate,
  formatDateTime,
  formatTimeWindow,
  mapChecklistSnapshot,
  mapServiceSnapshot,
  mapUpdateSnapshot,
  mergeServiceRealtime,
  normaliseStatus,
  toNewChecklist,
  toNewUpdates,
} from "./shared";

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

  const [service, setService] = useState<ServiceRealtimeData>(composedInitial);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(toNewChecklist(initialChecklist));
  const [updates, setUpdates] = useState<ServiceUpdate[]>(toNewUpdates(initialUpdates));
  const [connectionIssue, setConnectionIssue] = useState<string | null>(null);
  const normalizedInitialUpdates = useMemo(() => toNewUpdates(initialUpdates), [initialUpdates]);

  useEffect(() => {
    let cancelled = false;
    const unsubscribers: Array<() => void> = [];

    const { db, error } = tryGetFirestore();
    if (!db) {
      if (error) {
        console.warn("[service-detail] Firestore indisponível", error);
      }
      setConnectionIssue(
        "Sincronização temporariamente indisponível. Exibindo dados mais recentes carregados.",
      );
      return () => {
        cancelled = true;
      };
    }

    const serviceRef = doc(db, "services", serviceId);

    const handleError = (firestoreError: FirestoreError) => {
      if (cancelled) return;
      console.warn(`[service-detail] Falha na escuta do serviço ${serviceId}`, firestoreError);
      const message =
        firestoreError.code === "unavailable"
          ? "Conexão com o Firestore indisponível. Exibindo dados em cache."
          : "Não foi possível sincronizar com o Firestore. Tentaremos novamente.";
      setConnectionIssue(message);
    };

    unsubscribers.push(
      onSnapshot(
        serviceRef,
        (snapshot) => {
          if (cancelled) return;
          const mapped = mapServiceSnapshot(snapshot);
          setService((current) => mergeServiceRealtime(current, mapped));
          setConnectionIssue(null);
        },
        handleError,
      ),
    );

    unsubscribers.push(
      onSnapshot(
        query(collection(serviceRef, "updates"), orderBy("createdAt", "desc"), limit(100)),
        (snapshot) => {
          if (cancelled) return;
          const mapped = snapshot.docs.map((docSnap) => mapUpdateSnapshot(docSnap));
          setUpdates(toNewUpdates(mapped));
          setConnectionIssue(null);
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
        },
        handleError,
      ),
    );

    return () => {
      cancelled = true;
      unsubscribers.forEach((unsubscribe) => {
        try {
          unsubscribe();
        } catch (unsubscribeError) {
          console.warn("[service-detail] Falha ao cancelar listener", unsubscribeError);
        }
      });
    };
  }, [serviceId]);

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

  const companyLabel = useMemo(() => {
    if (service.assignedTo?.companyName) return service.assignedTo.companyName;
    if (service.assignedTo?.companyId) return service.assignedTo.companyId;
    if (service.company) return service.company;
    if (service.empresa) return service.empresa;
    return null;
  }, [service.assignedTo, service.company, service.empresa]);

  const statusLabel = useMemo(() => normaliseStatus(service.status), [service.status]);

  const displayedUpdates = updates.length ? updates : normalizedInitialUpdates;

  return (
    <div className="container mx-auto space-y-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
          <Link className="btn btn-primary" href={`/servicos/${service.id}/editar`}>
            <Pencil aria-hidden="true" className="h-4 w-4" />
            Editar
          </Link>
          <DeleteServiceButton serviceId={service.id} serviceLabel={serviceLabel} />
        </div>
      </div>

      {connectionIssue ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
          {connectionIssue}
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
            <div>
              <dt className="text-muted-foreground">Início planejado</dt>
              <dd className="font-medium">
                {formatDate(service.plannedStart ?? composedInitial.plannedStart ?? null)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Fim planejado</dt>
              <dd className="font-medium">
                {formatDate(service.plannedEnd ?? composedInitial.plannedEnd ?? null)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Última atualização</dt>
              <dd className="font-medium">
                {formatDateTime(service.updatedAt ?? composedInitial.updatedAt ?? null)}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Token de acesso</dt>
              <dd className="font-medium">
                {latestToken ? (
                  <div className="space-y-2">
                    <div className="inline-flex items-center rounded-md border border-primary/40 bg-primary/10 px-2 py-1 font-mono text-sm text-primary">
                      {latestToken.code}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {latestToken.company ? <span>Empresa vinculada: {latestToken.company}</span> : null}
                      {tokenLink ? (
                        <Link className="link text-xs" href={tokenLink} target="_blank" rel="noreferrer">
                          Abrir link público
                        </Link>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Nenhum token ativo</span>
                )}
              </dd>
            </div>
          </dl>
        </div>
        <SCurve planned={planned} realizedSeries={realizedSeries} realizedPercent={realizedPercent} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="text-lg font-semibold">Checklist</h2>
          {checklist.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Nenhum checklist cadastrado.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {checklist.map((item) => (
                <li key={item.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{item.description}</span>
                    <span className="text-xs text-muted-foreground">Peso: {item.weight}%</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
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
                const timeWindow = formatTimeWindow(update);
                const hours = computeTimeWindowHours(update);
                return (
                  <li key={update.id} className="space-y-2 rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-base font-semibold text-foreground">{Math.round(update.percent ?? 0)}%</span>
                      <span className="text-xs text-muted-foreground">{formatDateTime(update.createdAt)}</span>
                    </div>
                    {update.subactivity?.label ? (
                      <p className="text-xs text-muted-foreground">
                        Subatividade: <span className="font-medium text-foreground">{update.subactivity.label}</span>
                      </p>
                    ) : null}
                    {timeWindow ? <p className="text-xs text-muted-foreground">Período: {timeWindow}</p> : null}
                    {hours !== null ? (
                      <p className="text-xs text-muted-foreground">Horas informadas: {hours.toFixed(2)}</p>
                    ) : null}
                    {update.description ? <p className="text-sm text-foreground">{update.description}</p> : null}
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
                    {update.resources && update.resources.length > 0 ? (
                      <div className="text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">Recursos:</span>
                        <ul className="mt-1 space-y-1">
                          {update.resources.map((item, index) => (
                            <li key={index}>
                              {item.name}
                              {item.quantity !== null && item.quantity !== undefined
                                ? ` • ${item.quantity}${item.unit ? ` ${item.unit}` : ""}`
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
