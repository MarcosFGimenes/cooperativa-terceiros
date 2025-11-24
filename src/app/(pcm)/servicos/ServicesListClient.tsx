"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";

import {
  resolveServicoPercentualPlanejado,
  resolveServicoRealPercent,
} from "@/lib/serviceProgress";
import type { PCMListResponse, PCMServiceListItem } from "@/types/pcm";

const STATUS_LABEL: Record<string, string> = {
  concluido: "Concluído",
  "concluído": "Concluído",
  encerrado: "Concluído",
  pendente: "Pendente",
  aberto: "Aberto",
};

const STATUS_TONE: Record<string, string> = {
  Concluído: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Pendente: "bg-amber-100 text-amber-700 border-amber-200",
  Aberto: "bg-sky-100 text-sky-700 border-sky-200",
};

function normaliseStatus(status: PCMServiceListItem["status"]): string {
  const raw = String(status ?? "").trim().toLowerCase();
  return STATUS_LABEL[raw] ?? "Aberto";
}

function resolveIdentifier(service: PCMServiceListItem) {
  return service.os || service.code || service.tag || service.id;
}

function resolveSubtitle(service: PCMServiceListItem) {
  return service.equipmentName || service.equipamento || service.setor || service.sector || "";
}

function resolveCompanyLabel(service: PCMServiceListItem) {
  return (
    service.assignedTo?.companyName ||
    service.assignedTo?.companyId ||
    service.company ||
    service.empresa ||
    undefined
  );
}

type Props = {
  initialItems: PCMServiceListItem[];
  initialCursor: string | null;
};

export default function ServicesListClient({ initialItems, initialCursor }: Props) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const today = useMemo(() => new Date(), []);

  const handleLoadMore = useCallback(async () => {
    if (!cursor) return;
    setIsLoadingMore(true);
    setErrorMessage(null);
    try {
      const params = new URLSearchParams({ limit: "15", cursor });
      const response = await fetch(`/api/pcm/servicos?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Falha ao carregar mais serviços: ${response.status}`);
      }
      const payload = (await response.json()) as PCMListResponse<PCMServiceListItem>;
      setItems((prev) => [...prev, ...payload.items]);
      setCursor(payload.nextCursor ?? null);
    } catch (error) {
      console.error("[ServicesListClient] Falha ao carregar mais serviços", error);
      setErrorMessage("Não foi possível carregar mais serviços. Tente novamente.");
    } finally {
      setIsLoadingMore(false);
    }
  }, [cursor]);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((service) => {
          const serviceHref = `/servicos/${encodeURIComponent(service.id)}`;
          const statusLabel = normaliseStatus(service.status);
          const statusTone = STATUS_TONE[statusLabel] ?? "border-border bg-muted text-foreground/80";
          const plannedPercent = Math.round(resolveServicoPercentualPlanejado(service, today));
          const realPercent = resolveServicoRealPercent(service);
          const identifier = resolveIdentifier(service);
          const subtitle = resolveSubtitle(service);
          const companyLabel = resolveCompanyLabel(service);

          return (
            <Link
              key={service.id}
              className="group flex flex-col gap-4 rounded-2xl border bg-card/80 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md focus-visible:outline-none focus-visible:ring"
              href={serviceHref}
            >
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusTone}`}>
                    {statusLabel}
                  </span>
                  <span className="rounded-full border border-transparent bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground">
                    {realPercent}% concluído
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="line-clamp-2 text-base font-semibold text-foreground">{identifier}</p>
                  {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
                  <p className="text-xs text-muted-foreground">
                    Planejado: <span className="font-semibold text-foreground">{plannedPercent}%</span> | Real:{" "}
                    <span className="font-semibold text-foreground">{realPercent}%</span>
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${realPercent}%` }} />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{companyLabel ? `Empresa: ${companyLabel}` : `Pacote: ${service.packageId ?? "Não vinculado"}`}</span>
                  <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground/80 transition group-hover:bg-primary/10 group-hover:text-primary">
                    Ver serviço
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      <div className="flex flex-col gap-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p>Mostrando {items.length} serviço{items.length === 1 ? "" : "s"}.</p>
          {errorMessage ? <p className="text-destructive">{errorMessage}</p> : null}
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!cursor || isLoadingMore}
          onClick={handleLoadMore}
        >
          {isLoadingMore ? "Carregando..." : cursor ? "Carregar mais" : "Todos carregados"}
        </button>
      </div>
    </div>
  );
}
