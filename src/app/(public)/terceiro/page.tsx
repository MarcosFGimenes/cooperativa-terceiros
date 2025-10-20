"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onSnapshot } from "firebase/firestore";

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
  if (raw === "concluido" || raw === "concluído") return "Concluído";
  if (raw === "encerrado") return "Encerrado";
  return "Aberto";
}

export default function TerceiroHome() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [items, setItems] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      setLoading(true);
      try {
        const response = await fetch("/api/terceiro/session", { cache: "no-store" });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          if (!cancelled) {
            setError(payload?.error ?? "Não foi possível carregar os dados.");
            setItems([]);
            setCompanyId(null);
          }
          return;
        }

        const data = await response.json();
        if (cancelled) return;
        const list = Array.isArray(data?.services) ? (data.services as ServiceItem[]) : [];
        setItems(list);
        setError(null);
        const company = typeof data?.companyId === "string" && data.companyId ? data.companyId : null;
        setCompanyId(company);
        if (company && typeof window !== "undefined") {
          localStorage.setItem("companyId", company);
        }
      } catch (err) {
        console.error("[terceiro] falha ao carregar sessão", err);
        if (!cancelled) {
          setError("Não foi possível carregar as informações do token.");
          setItems([]);
          setCompanyId(null);
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
    };
  }, []);

  useEffect(() => {
    if (!companyId) return undefined;
    const query = servicesQueryForCompany(companyId);
    const unsubscribe = onSnapshot(query, (snapshot) => {
      setItems(snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as ServiceItem) })));
    });
    return () => unsubscribe();
  }, [companyId]);

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

      {loading ? (
        <div className="card p-6 text-sm text-muted-foreground">Carregando…</div>
      ) : error ? (
        <div className="card p-6 text-sm text-muted-foreground">{error}</div>
      ) : items.length === 0 ? (
        <div className="card p-6 text-sm text-muted-foreground">Nenhum serviço atribuído.</div>
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
                href={`/s/${service.id}`}
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
