"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import ServiceUpdateForm from "@/components/ServiceUpdateForm";

import type { ThirdChecklistItem, ThirdService, ThirdServiceUpdate } from "./types";

type ServiceDetailsClientProps = {
  service: ThirdService;
  updates: ThirdServiceUpdate[];
  checklist: ThirdChecklistItem[];
};

const MAX_UPDATES = 20;

function clampPercent(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(100, Math.max(0, numeric));
}

function formatDate(value?: number | string | null): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat("pt-BR").format(date);
    }
    return "-";
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "-";
    const date = new Date(trimmed);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat("pt-BR").format(date);
    }
  }

  return "-";
}

function normaliseStatus(value: string | null | undefined): string {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "concluido" || raw === "concluído") return "Concluído";
  if (raw === "encerrado") return "Encerrado";
  return "Aberto";
}

function formatChecklistStatus(status: ThirdChecklistItem["status"]): string {
  if (status === "concluido") return "Concluído";
  if (status === "em-andamento") return "Em andamento";
  return "Não iniciado";
}

function computeInitialProgress(service: ThirdService, updates: ThirdServiceUpdate[]): number {
  if (updates.length > 0) {
    return clampPercent(updates[0]?.percent ?? 0);
  }

  const candidates = [service.realPercent, service.manualPercent, service.andamento];
  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return clampPercent(value);
    }
  }

  return 0;
}

export default function ServiceDetailsClient({ service, updates: initialUpdates, checklist }: ServiceDetailsClientProps) {
  const sortedInitialUpdates = useMemo(
    () => [...initialUpdates].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
    [initialUpdates],
  );

  const [updates, setUpdates] = useState(sortedInitialUpdates);
  const [progress, setProgress] = useState(() => computeInitialProgress(service, sortedInitialUpdates));

  const serviceLabel = useMemo(() => {
    if (service.os && service.os.trim()) return service.os.trim();
    if (service.code && service.code.trim()) return service.code.trim();
    return service.id;
  }, [service]);

  const lastUpdateAt = updates[0]?.createdAt ?? service.updatedAt ?? null;

  const detailItems = useMemo(
    () => [
      { label: "Status", value: normaliseStatus(service.status) },
      { label: "Andamento", value: `${Math.round(progress)}%` },
      { label: "Código", value: service.code?.trim() || "—" },
      { label: "Ordem de compra", value: service.oc?.trim() || "—" },
      { label: "Tag", value: service.tag?.trim() || "—" },
      { label: "Equipamento", value: service.equipmentName?.trim() || "—" },
      { label: "Setor", value: service.sector?.trim() || "—" },
      {
        label: "Horas totais",
        value:
          typeof service.totalHours === "number" && Number.isFinite(service.totalHours)
            ? service.totalHours
            : "—",
      },
      { label: "Início planejado", value: formatDate(service.plannedStart) },
      { label: "Fim planejado", value: formatDate(service.plannedEnd) },
      { label: "Empresa atribuída", value: service.company?.trim() || "—" },
      { label: "Última atualização", value: formatDate(lastUpdateAt) },
    ],
    [service, progress, lastUpdateAt],
  );

  async function handleUpdateSubmit(data: { progress: number; note?: string }) {
    let errorMessage = "Não foi possível registrar a atualização.";

    try {
      const response = await fetch(`/api/public/service/update-manual?serviceId=${encodeURIComponent(service.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ percent: data.progress, note: data.note }),
      });

      const json = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string; realPercent?: number }
        | null;

      if (!response.ok || !json?.ok) {
        errorMessage = json?.error ?? errorMessage;
        throw new Error(errorMessage);
      }

      const sanitisedPercent = clampPercent(
        Number.isFinite(json.realPercent) ? Number(json.realPercent) : data.progress,
      );
      const createdAt = Date.now();
      const description = data.note?.trim() ? data.note.trim() : undefined;

      setUpdates((prev) => {
        const next = [
          { id: `local-${createdAt}`, percent: sanitisedPercent, description, createdAt },
          ...prev,
        ];
        return next.slice(0, MAX_UPDATES);
      });

      setProgress(sanitisedPercent);
    } catch (error) {
      toast.error(errorMessage);
      throw error instanceof Error ? error : new Error(errorMessage);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Serviço {serviceLabel}</h1>

      <div className="grid gap-4 lg:grid-cols-[1fr_minmax(320px,380px)]">
        <div className="card p-4">
          <h2 className="mb-4 text-lg font-semibold">Informações gerais</h2>
          <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            {detailItems.map((item) => (
              <div key={item.label}>
                <dt className="text-muted-foreground">{item.label}</dt>
                <dd className="font-medium">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="card space-y-4 p-4">
          <div>
            <div className="text-sm text-muted-foreground">Progresso atual</div>
            <div className="mt-2 text-3xl font-semibold">{Math.round(progress)}%</div>
            <div className="mt-3 h-2 w-full rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${clampPercent(progress)}%` }}
              />
            </div>
          </div>

          {service.hasChecklist ? (
            <div className="rounded-lg border border-dashed border-muted-foreground/40 bg-muted/20 p-3 text-sm text-muted-foreground">
              Este serviço utiliza checklist para cálculo do andamento. Solicite ao PCM responsável a
              atualização dos itens do checklist.
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Informe o percentual total concluído e descreva o que foi realizado no período.
              </p>
              <ServiceUpdateForm lastProgress={Math.round(progress)} onSubmit={handleUpdateSubmit} />
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="text-lg font-semibold">Checklist</h2>
          {checklist.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Nenhum item de checklist disponível.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {checklist.map((item) => (
                <li key={item.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{item.description}</span>
                    <span className="text-xs text-muted-foreground">Peso: {Math.round(item.weight)}%</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      Status: {formatChecklistStatus(item.status)}
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
          {updates.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Nenhuma atualização registrada.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {updates.slice(0, 10).map((update) => (
                <li key={update.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{Math.round(update.percent)}%</span>
                    <span className="text-xs text-muted-foreground">{formatDate(update.createdAt)}</span>
                  </div>
                  {update.description ? (
                    <p className="mt-2 text-xs text-muted-foreground">{update.description}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
