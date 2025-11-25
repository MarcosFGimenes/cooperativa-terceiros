"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import {
  resolveServicoPercentualPlanejado,
  resolveServicoRealPercent,
} from "@/lib/serviceProgress";
import { formatDateTime } from "@/lib/formatDateTime";
import ReferenceDateSelector from "@/components/ReferenceDateSelector";
import { formatReferenceLabel, resolveReferenceDate } from "@/lib/referenceDate";
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
  const [osFilter, setOsFilter] = useState("");
  const searchParams = useSearchParams();
  const refDateParam = searchParams?.get("refDate") ?? null;
  const { date: referenceDate, inputValue: referenceDateInput } = useMemo(
    () => resolveReferenceDate(refDateParam),
    [refDateParam],
  );
  const referenceLabel = useMemo(() => formatReferenceLabel(referenceDate), [referenceDate]);

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

  const filteredItems = useMemo(() => {
    if (!osFilter.trim()) return items;
    const needle = osFilter.trim().toLowerCase();
    return items.filter((service) => {
      const osValue = service.os || service.code || service.tag || "";
      return osValue.toLowerCase().includes(needle);
    });
  }, [items, osFilter]);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4">
        <div className="space-y-1 text-sm text-muted-foreground">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Data de referência</p>
          <p className="font-semibold text-foreground">{referenceLabel}</p>
          <p className="text-[13px]">Ajuste a data para ver percentuais planejados e realizados.</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end sm:gap-4">
          <div className="w-full min-w-[220px] sm:w-60">
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Filtro por O.S</label>
            <input
              type="text"
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Ex.: 12345"
              value={osFilter}
              onChange={(event) => setOsFilter(event.target.value)}
            />
          </div>
          <div className="w-full max-w-[220px] sm:w-56">
            <ReferenceDateSelector value={referenceDateInput} />
          </div>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          Nenhum serviço encontrado para este filtro de O.S.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredItems.map((service) => {
            const serviceHref = `/servicos/${encodeURIComponent(service.id)}`;
            const statusLabel = normaliseStatus(service.status);
            const statusTone = STATUS_TONE[statusLabel] ?? "border-border bg-muted text-foreground/80";
            const plannedPercent = Math.round(resolveServicoPercentualPlanejado(service, referenceDate));
            const realPercent = Math.round(resolveServicoRealPercent(service, referenceDate));
            const isComplete = realPercent >= 100;
            const identifier = resolveIdentifier(service);
            const subtitle = resolveSubtitle(service);
            const companyLabel = resolveCompanyLabel(service);
            const lastUpdate = service.updatedAt ?? service.createdAt ?? null;
            const lastUpdateLabel =
              typeof lastUpdate === "number"
                ? formatDateTime(lastUpdate, { timeZone: "America/Sao_Paulo", fallback: "" })
                : "";

            return (
              <Link
                key={service.id}
                className="group flex flex-col gap-4 rounded-2xl border bg-card/80 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md focus-visible:outline-none focus-visible:ring"
                href={serviceHref}
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusTone}`}>
                        {statusLabel}
                      </span>
                      <span
                        className={`rounded-full border border-transparent px-2 py-0.5 text-xs ${
                          isComplete ? "bg-emerald-100 text-emerald-700" : "bg-muted/60 text-muted-foreground"
                        }`}
                      >
                        {realPercent}% concluído (em {referenceLabel})
                      </span>
                    </div>
                    {lastUpdateLabel ? (
                      <span className="whitespace-nowrap text-[11px] font-medium text-muted-foreground">
                        Atualizado em {lastUpdateLabel}
                      </span>
                    ) : null}
                  </div>
                  <div className="space-y-1">
                    <p className="line-clamp-2 text-base font-semibold text-foreground">{identifier}</p>
                    {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
                    <p className="text-xs text-muted-foreground">
                      Planejado ({referenceLabel}): <span className="font-semibold text-foreground">{plannedPercent}%</span> |
                      Real ({referenceLabel}): <span className="font-semibold text-foreground">{realPercent}%</span>
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isComplete ? "bg-emerald-500" : "bg-primary"
                      }`}
                      style={{ width: `${realPercent}%` }}
                    />
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
      )}
      <div className="flex flex-col gap-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p>
            Mostrando {filteredItems.length} serviço{filteredItems.length === 1 ? "" : "s"}
            {osFilter.trim() ? " (após filtro)" : ""}.
          </p>
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
