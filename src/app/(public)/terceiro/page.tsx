"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onSnapshot, type FirestoreError } from "firebase/firestore";

import { isFirestoreLongPollingForced, tryGetAuth } from "@/lib/firebase";
import { recordTelemetry } from "@/lib/telemetry";
import { servicesQueryForCompany } from "@/lib/repo/services-client";

type ServiceItem = {
  id: string;
  os?: string | null;
  tag?: string | null;
  equipmentName?: string | null;
  status?: string | null;
  andamento?: number | null;
  realPercent?: number | null;
  progress?: number | null;
};

function normaliseProgress(value?: number | null) {
  if (!Number.isFinite(value ?? NaN)) return 0;
  return Math.max(0, Math.min(100, Math.round(Number(value ?? 0))));
}

function normaliseStatus(value?: string | null) {
  const raw = String(value ?? "").toLowerCase();
  if (raw === "concluido" || raw === "concluído" || raw === "encerrado") return "Concluído";
  if (raw === "pendente") return "Pendente";
  return "Aberto";
}

export default function TerceiroHome() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [items, setItems] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenExpired, setTokenExpired] = useState(false);
  const [connectionIssue, setConnectionIssue] = useState<string | null>(null);
  const [sessionRetryKey, setSessionRetryKey] = useState(0);
  const [listenerSeed, setListenerSeed] = useState(0);
  const longPollingForced = isFirestoreLongPollingForced;
  const tokenStorageKey = "third_portal_token";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("companyId");
    if (stored) {
      setCompanyId((current) => current ?? stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleOnline = () => {
      setConnectionIssue(null);
      setSessionRetryKey((value) => value + 1);
      setListenerSeed((value) => value + 1);
    };
    const handleOffline = () => {
      setConnectionIssue("Sem conexão com a internet. Exibindo dados disponíveis.");
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    async function loadSession() {
      setLoading(true);
      try {
        const response = await fetch("/api/terceiro/session", { cache: "no-store" });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          if (cancelled) return;

          if (response.status === 401 || payload?.error === "missing_token") {
            setError("token-expired");
            setTokenExpired(true);
            setItems([]);
            setCompanyId(null);
            recordTelemetry("token.session.missing", {});
            try {
              window.sessionStorage.removeItem(tokenStorageKey);
            } catch (storageError) {
              console.warn("[terceiro] falha ao limpar token armazenado", storageError);
            }
            if (typeof window !== "undefined") {
              retryTimeout = window.setTimeout(() => {
                setSessionRetryKey((value) => value + 1);
              }, 200);
            }
            return;
          }

          if (response.status >= 500) {
            const message =
              typeof payload?.error === "string" && payload.error
                ? payload.error
                : "Serviço temporariamente indisponível. Tentaremos novamente em instantes.";
            setConnectionIssue(message);
            if (typeof window !== "undefined") {
              retryTimeout = window.setTimeout(() => {
                setSessionRetryKey((value) => value + 1);
              }, 5000);
            }
            return;
          }

          const message =
            typeof payload?.error === "string" && payload.error
              ? payload.error
              : "Não foi possível carregar os dados.";
          if (payload?.error === "token_not_found") {
            setError("token-expired");
            setTokenExpired(true);
            recordTelemetry("token.session.expired", {});
          } else {
            setError(message);
            setTokenExpired(false);
          }
          setItems([]);
          setCompanyId(null);
          setConnectionIssue(null);
          return;
        }

        const data = await response.json();
        if (cancelled) return;
        const list = Array.isArray(data?.services) ? (data.services as ServiceItem[]) : [];
        setItems(list);
        setError(null);
        setTokenExpired(false);
        setConnectionIssue(null);
        const company = typeof data?.companyId === "string" && data.companyId ? data.companyId : null;
        setCompanyId(company);
        if (company && typeof window !== "undefined") {
          localStorage.setItem("companyId", company);
        }
      } catch (err) {
        console.warn("[terceiro] falha ao carregar sessão", err);
        if (!cancelled) {
          const isOffline = typeof navigator !== "undefined" && navigator.onLine === false;
          setConnectionIssue(
            isOffline
              ? "Sem conexão com a internet. Tentaremos sincronizar assim que possível."
              : "Não foi possível atualizar as informações. Tentaremos novamente em instantes.",
          );
          if (typeof window !== "undefined") {
            retryTimeout = window.setTimeout(() => {
              setSessionRetryKey((value) => value + 1);
            }, 5000);
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSession();

    return () => {
      cancelled = true;
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [sessionRetryKey]);

  useEffect(() => {
    if (!companyId) return undefined;

    let active = true;
    let unsubscribe: (() => void) | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    const scheduleRetry = () => {
      if (typeof window === "undefined") return;
      retryTimeout = window.setTimeout(() => {
        setListenerSeed((value) => value + 1);
      }, 5000);
    };

    const attachListener = () => {
      try {
        const { auth } = tryGetAuth();
        const hasAuthenticatedUser = Boolean(auth?.currentUser);
        if (!hasAuthenticatedUser) {
          console.warn("[terceiro] usuário sem permissão para sync em tempo real - listener não iniciado");
          setConnectionIssue("Sincronização em tempo real não disponível para este usuário.");
          return;
        }
        const query = servicesQueryForCompany(companyId);
        unsubscribe = onSnapshot(
          query,
          (snapshot) => {
            if (!active) return;
            setConnectionIssue(null);
            setItems(snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as ServiceItem) })));
          },
          (err) => {
            if (!active) return;
            const errorObject = err as FirestoreError | undefined;
            if (errorObject?.code === "permission-denied") {
              console.warn("[terceiro] usuário sem permissão para sync em tempo real", errorObject);
              setConnectionIssue("Sincronização em tempo real não disponível para este usuário.");
              return;
            }
            const message =
              errorObject?.code === "unavailable"
                ? longPollingForced
                  ? "Conexão com o Firestore indisponível. Continuaremos tentando via long-polling."
                  : "Conexão indisponível. Considere ativar long-polling."
                : "Não foi possível sincronizar com o Firestore. Tentaremos novamente.";
            console.warn("[terceiro] falha na escuta de serviços", errorObject ?? err);
            setConnectionIssue(message);
            scheduleRetry();
          },
        );
      } catch (err) {
        if (!active) return;
        console.warn("[terceiro] não foi possível iniciar a sincronização", err);
        const hint = longPollingForced
          ? "Conexão com o Firestore indisponível. Continuaremos tentando via long-polling."
          : "Conexão indisponível. Considere ativar long-polling.";
        setConnectionIssue(hint);
        scheduleRetry();
      }
    };

    attachListener();

    return () => {
      active = false;
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [companyId, listenerSeed, longPollingForced]);

  return (
    <div className="container mx-auto space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Meus Serviços</h1>
          <p className="text-sm text-muted-foreground">
            Serviços abertos atribuídos à sua empresa.
            {companyId ? <span className="ml-2 text-xs uppercase tracking-wide">Empresa: {companyId}</span> : null}
          </p>
        </div>
      </div>

      {connectionIssue && !error ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
          {connectionIssue}
        </div>
      ) : null}

      {loading ? (
        <div className="card p-6 text-sm text-muted-foreground">Carregando…</div>
      ) : error ? (
        <div className="card space-y-3 p-6 text-sm text-muted-foreground">
          {tokenExpired ? (
            <>
              <p>O acesso público expirou. Solicite um novo link para continuar acompanhando os serviços.</p>
              <Link className="text-primary underline" href="/acesso">
                Gerar novo acesso
              </Link>
            </>
          ) : (
            error
          )}
        </div>
      ) : items.length === 0 ? (
        <div className="card p-6 text-sm text-muted-foreground">
          {connectionIssue ? "Nenhum dado disponível no momento. Aguarde a reconexão." : "Nenhum serviço atribuído."}
        </div>
      ) : (
        <div className="card divide-y">
          {items.map((service) => {
            const progress = normaliseProgress(
              service.progress ?? service.realPercent ?? service.andamento ?? 0,
            );
            return (
              <Link
                key={service.id}
                className="flex items-center gap-3 p-4 transition hover:bg-muted/40"
                href={`/terceiro/servico/${service.id}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {service.os || service.id}
                    {service.equipmentName
                      ? ` — ${service.equipmentName}`
                      : service.tag
                        ? ` — ${service.tag}`
                        : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">{normaliseStatus(service.status)}</p>
                </div>
                <span className="text-sm font-semibold text-primary">{progress}%</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
