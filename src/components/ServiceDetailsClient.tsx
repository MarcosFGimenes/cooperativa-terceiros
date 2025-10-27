"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import ServiceUpdateForm, { type ServiceUpdateFormPayload } from "@/components/ServiceUpdateForm";

import type { ThirdChecklistItem, ThirdService, ThirdServiceUpdate } from "@/app/(third)/terceiro/servico/[id]/types";

type ServiceDetailsClientProps = {
  service: ThirdService;
  updates: ThirdServiceUpdate[];
  checklist: ThirdChecklistItem[];
  token?: string;
};

const MAX_UPDATES = 20;

function clampPercent(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(100, Math.max(0, numeric));
}

function formatDate(value?: number | string | null, withTime = false): string {
  if (value === null || value === undefined) return "-";
  const date = typeof value === "number" ? new Date(value) : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: withTime ? "short" : undefined,
  }).format(date);
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

function computeChecklistSuggestion(checklist: ThirdChecklistItem[]): number | undefined {
  if (!Array.isArray(checklist) || checklist.length === 0) return undefined;
  let weighted = 0;
  let totalWeight = 0;
  checklist.forEach((item) => {
    const weight = Number(item.weight ?? 0);
    const progress = Number(item.progress ?? 0);
    if (!Number.isFinite(weight) || !Number.isFinite(progress)) return;
    weighted += weight * progress;
    totalWeight += weight;
  });
  if (!totalWeight) return undefined;
  return Math.round((weighted / totalWeight) * 10) / 10;
}

function formatTimeWindow(update: ThirdServiceUpdate): string | null {
  const start = update.timeWindow?.start;
  const end = update.timeWindow?.end;
  if (start === null || start === undefined || end === null || end === undefined) return null;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
  const sameDay = startDate.toDateString() === endDate.toDateString();
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: sameDay ? undefined : "short",
    timeStyle: "short",
  });
  const startLabel = formatter.format(startDate);
  const endLabel = formatter.format(endDate);
  if (sameDay) {
    const dateLabel = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(startDate);
    return `${dateLabel}, ${startLabel} - ${endLabel}`;
  }
  return `${startLabel} → ${endLabel}`;
}

function computeTimeWindowHours(update: ThirdServiceUpdate): number | null {
  const raw = update.timeWindow?.hours;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.round(raw * 100) / 100;
  }
  if (typeof raw === "string" && raw.trim()) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      return Math.round(parsed * 100) / 100;
    }
  }
  const start = update.timeWindow?.start;
  const end = update.timeWindow?.end;
  if (start === null || start === undefined || end === null || end === undefined) return null;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
  const diff = (endDate.getTime() - startDate.getTime()) / 3_600_000;
  if (!Number.isFinite(diff) || diff < 0) return null;
  return Math.round(diff * 100) / 100;
}

const SHIFT_LABELS = {
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
} as const satisfies Record<"manha" | "tarde" | "noite", string>;

const WEATHER_LABELS = {
  claro: "Claro",
  nublado: "Nublado",
  chuvoso: "Chuvoso",
} as const satisfies Record<"claro" | "nublado" | "chuvoso", string>;

const CONDITION_LABELS = {
  praticavel: "Praticável",
  impraticavel: "Impraticável",
} as const satisfies Record<"praticavel" | "impraticavel", string>;

function getShiftLabel(value?: string | null) {
  if (!value) return "";
  const key = value.toLowerCase() as keyof typeof SHIFT_LABELS;
  return SHIFT_LABELS[key] ?? value;
}

function getWeatherLabel(value?: string | null) {
  if (!value) return "";
  const key = value.toLowerCase() as keyof typeof WEATHER_LABELS;
  return WEATHER_LABELS[key] ?? value;
}

function getConditionLabel(value?: string | null) {
  if (!value) return "";
  const key = value.toLowerCase() as keyof typeof CONDITION_LABELS;
  return CONDITION_LABELS[key] ?? value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toTimestampMs(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? Date.now() : time;
  }
  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
    const parsed = new Date(value);
    const time = parsed.getTime();
    return Number.isNaN(time) ? Date.now() : time;
  }
  return Date.now();
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function toThirdUpdate(update: unknown): ThirdServiceUpdate {
  const record = isRecord(update) ? update : {};
  const timeWindowRecord = isRecord(record.timeWindow) ? record.timeWindow : null;
  const timeWindowCandidate = timeWindowRecord
    ? {
        start: toNullableNumber(timeWindowRecord.start),
        end: toNullableNumber(timeWindowRecord.end),
        hours: toNullableNumber(timeWindowRecord.hours),
      }
    : undefined;
  const timeWindow =
    timeWindowCandidate &&
    timeWindowCandidate.start === null &&
    timeWindowCandidate.end === null &&
    timeWindowCandidate.hours === null
      ? undefined
      : timeWindowCandidate;

  const subactivityRecord = isRecord(record.subactivity) ? record.subactivity : null;
  const subactivity = subactivityRecord
    ? {
        id: toOptionalString(subactivityRecord.id) ?? null,
        label: toOptionalString(subactivityRecord.label) ?? null,
      }
    : undefined;

  const workforce = Array.isArray(record.workforce)
    ? record.workforce
        .map((item) => {
          if (!isRecord(item)) return null;
          const role = toOptionalString(item.role);
          if (!role) return null;
          const quantityValue =
            typeof item.quantity === "number"
              ? item.quantity
              : typeof item.quantity === "string"
                ? Number(item.quantity)
                : undefined;
          const numeric =
            quantityValue !== undefined && Number.isFinite(quantityValue)
              ? Math.max(1, Math.round(Number(quantityValue)))
              : 1;
          return { role, quantity: numeric };
        })
        .filter(isPresent)
    : undefined;

  const shiftConditions = Array.isArray(record.shiftConditions)
    ? record.shiftConditions
        .map((item) => {
          if (!isRecord(item)) return null;
          const shiftRaw = toOptionalString(item.shift)?.toLowerCase();
          const weatherRaw = toOptionalString(item.weather)?.toLowerCase();
          const conditionRaw = toOptionalString(item.condition)?.toLowerCase();
          if (!shiftRaw || !weatherRaw || !conditionRaw) return null;
          if (!SHIFT_LABELS[shiftRaw as keyof typeof SHIFT_LABELS]) return null;
          if (!WEATHER_LABELS[weatherRaw as keyof typeof WEATHER_LABELS]) return null;
          if (!CONDITION_LABELS[conditionRaw as keyof typeof CONDITION_LABELS]) return null;
          return {
            shift: shiftRaw as "manha" | "tarde" | "noite",
            weather: weatherRaw as "claro" | "nublado" | "chuvoso",
            condition: conditionRaw as "praticavel" | "impraticavel",
          };
        })
        .filter(isPresent)
    : undefined;

  const impediments = Array.isArray(record.impediments)
    ? record.impediments
        .map((item) => {
          if (!isRecord(item)) return null;
          const type = toOptionalString(item.type);
          if (!type) return null;
          return { type, durationHours: toNullableNumber(item.durationHours) };
        })
        .filter(isPresent)
    : undefined;

  const resources = Array.isArray(record.resources)
    ? record.resources
        .map((item) => {
          if (!isRecord(item)) return null;
          const name = toOptionalString(item.name);
          if (!name) return null;
          return {
            name,
            quantity: toNullableNumber(item.quantity),
            unit: toOptionalString(item.unit) ?? null,
          };
        })
        .filter(isPresent)
    : undefined;

  const evidences = Array.isArray(record.evidences)
    ? record.evidences
        .map((item) => {
          if (!isRecord(item)) return null;
          const url = toOptionalString(item.url);
          if (!url) return null;
          return { url, label: toOptionalString(item.label) ?? null };
        })
        .filter(isPresent)
    : undefined;

  const previousPercent = toNullableNumber(record.previousPercent);

  return {
    id: String(record.id ?? crypto.randomUUID()),
    percent: clampPercent(record.percent ?? record.realPercentSnapshot ?? record.manualPercent ?? 0),
    description:
      typeof record.description === "string"
        ? record.description
        : typeof record.note === "string"
          ? record.note
          : undefined,
    createdAt: toTimestampMs(record.createdAt ?? record.createdAtMillis ?? record.createdAtMs ?? undefined),
    timeWindow,
    subactivity,
    mode: record.mode === "detailed" || record.mode === "simple" ? record.mode : undefined,
    impediments,
    resources,
    workforce,
    shiftConditions,
    forecastDate: toNullableNumber(record.forecastDate),
    criticality: toNullableNumber(record.criticality),
    evidences,
    justification: toOptionalString(record.justification) ?? null,
    previousPercent: previousPercent ?? null,
    declarationAccepted:
      typeof record.declarationAccepted === "boolean" ? record.declarationAccepted : undefined,
  };
}

export default function ServiceDetailsClient({ service, updates: initialUpdates, checklist, token }: ServiceDetailsClientProps) {
  const sortedInitialUpdates = useMemo(
    () => [...initialUpdates].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
    [initialUpdates],
  );

  const [updates, setUpdates] = useState(sortedInitialUpdates);
  const [progress, setProgress] = useState(() => computeInitialProgress(service, sortedInitialUpdates));
  const [storedSubactivity, setStoredSubactivity] = useState<{ id?: string; label?: string } | null>(null);

  const serviceLabel = useMemo(() => {
    if (service.os && service.os.trim()) return service.os.trim();
    if (service.code && service.code.trim()) return service.code.trim();
    return service.id;
  }, [service]);

  const companyLabel = useMemo(() => {
    if (service.company && service.company.trim()) return service.company.trim();
    return null;
  }, [service.company]);

  const lastUpdateAt = updates[0]?.createdAt ?? service.updatedAt ?? null;
  const suggestion = useMemo(() => computeChecklistSuggestion(checklist), [checklist]);

  const detailItems = useMemo(
    () => [
      { label: "Status", value: normaliseStatus(service.status) },
      { label: "Andamento", value: `${progress.toFixed(1)}%` },
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
      { label: "Empresa atribuída", value: companyLabel || "—" },
      { label: "Última atualização", value: formatDate(lastUpdateAt, true) },
    ],
    [service, progress, lastUpdateAt, companyLabel],
  );

  const subactivityStorageKey = useMemo(
    () => `third-service:${service.id}:last-subactivity`,
    [service.id],
  );

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(subactivityStorageKey);
      if (!stored) return;
      const parsed = JSON.parse(stored) as { id?: string; label?: string } | null;
      if (parsed && (parsed.id || parsed.label)) {
        setStoredSubactivity(parsed);
      }
    } catch (error) {
      console.warn("[service-details] Falha ao carregar subatividade recente", error);
    }
  }, [subactivityStorageKey]);

  const persistSubactivity = useCallback(
    (value: { id?: string; label?: string }) => {
      setStoredSubactivity(value);
      try {
        window.localStorage.setItem(subactivityStorageKey, JSON.stringify(value));
      } catch (error) {
        console.warn("[service-details] Falha ao salvar subatividade", error);
      }
    },
    [subactivityStorageKey],
  );

  const handleUpdateSubmit = useCallback(
    async (payload: ServiceUpdateFormPayload) => {
      const url = new URL(`/api/public/service/update-manual`, window.location.origin);
      url.searchParams.set("serviceId", service.id);
      if (token) {
        url.searchParams.set("token", token);
      }

      const resourcesPayload = payload.resources.map((item) => ({
        name: item.name,
        quantity: null,
        unit: null,
      }));

      const body: Record<string, unknown> = {
        percent: payload.percent,
        description: payload.description,
        timeWindow: { start: payload.start, end: payload.end },
        subactivity:
          payload.subactivityId || payload.subactivityLabel
            ? { id: payload.subactivityId, label: payload.subactivityLabel }
            : undefined,
        mode: "simple",
        resources: resourcesPayload,
        workforce: payload.workforce,
        shiftConditions: payload.shiftConditions,
        justification: payload.justification,
        declarationAccepted: payload.declarationAccepted,
      };

      let errorMessage = "Não foi possível registrar a atualização.";

      try {
        const response = await fetch(url.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const json = (await response.json().catch(() => null)) as
          | { ok?: boolean; error?: string; realPercent?: number; update?: unknown }
          | null;

        if (!response.ok || !json?.ok) {
          errorMessage = json?.error ?? errorMessage;
          throw new Error(errorMessage);
        }

        const nextPercent = clampPercent(
          Number.isFinite(json.realPercent) ? Number(json.realPercent) : payload.percent,
        );

        if (json.update) {
          const mapped = toThirdUpdate(json.update);
          setUpdates((prev) => {
            const next = [mapped, ...prev];
            return next
              .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
              .slice(0, MAX_UPDATES);
          });
        } else {
          const createdAt = Date.now();
          setUpdates((prev) => {
            const next = [
              {
                id: `local-${createdAt}`,
                percent: nextPercent,
                description: payload.description,
                createdAt,
                timeWindow: {
                  start: new Date(payload.start).getTime(),
                  end: new Date(payload.end).getTime(),
                  hours: (new Date(payload.end).getTime() - new Date(payload.start).getTime()) / 3_600_000,
                },
                subactivity:
                  payload.subactivityId || payload.subactivityLabel
                    ? { id: payload.subactivityId, label: payload.subactivityLabel }
                    : undefined,
                mode: "simple",
                resources: resourcesPayload,
                workforce: payload.workforce,
                shiftConditions: payload.shiftConditions,
                justification: payload.justification ?? null,
                previousPercent: progress,
                declarationAccepted: true,
              },
              ...prev,
            ];
            return next.slice(0, MAX_UPDATES);
          });
        }

        setProgress(nextPercent);
        toast.success("Atualização registrada com sucesso!");
      } catch (error) {
        console.error("[service-details] Falha ao registrar atualização", error);
        toast.error(errorMessage);
        throw error instanceof Error ? error : new Error(errorMessage);
      }
    },
    [progress, service.id, token],
  );

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col space-y-6">
      <div className="card p-4">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Portal do Terceiro</p>
            <h1 className="text-3xl font-semibold text-foreground">OS: {serviceLabel}</h1>
            <p className="text-sm text-muted-foreground">Formulário Único de Atualização diária.</p>
          </div>
          <div className="lg:ml-auto lg:min-w-[420px] lg:max-w-[540px]">
            <div className="grid gap-4 rounded-lg border border-dashed p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-2">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">FO</span>
                <span className="text-base font-semibold text-foreground">FO – xxxx xx xxxx</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Emissão</span>
                <span className="text-base font-medium text-muted-foreground opacity-60">—</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Revisão</span>
                <span className="text-base font-medium text-muted-foreground opacity-60">—</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Número</span>
                <span className="text-base font-medium text-muted-foreground opacity-60">—</span>
              </div>
            </div>
          </div>
        </div>
      </div>

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

        <div className="card space-y-5 p-4">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Atualização diária</h2>
            <p className="text-sm text-muted-foreground">
              Preencha o registro do dia com horários, subatividade, recursos utilizados, mão de obra e condições de trabalho
              por turno.
            </p>
          </div>

          <div>
            <div className="text-sm text-muted-foreground">Progresso atual</div>
            <div className="mt-2 text-3xl font-semibold">{progress.toFixed(1)}%</div>
            <div className="mt-3 h-2 w-full rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${clampPercent(progress)}%` }}
              />
            </div>
          </div>

          <ServiceUpdateForm
            serviceId={service.id}
            lastProgress={progress}
            suggestedPercent={suggestion}
            checklist={checklist.map((item) => ({ id: item.id, description: item.description }))}
            defaultSubactivityId={storedSubactivity?.id}
            defaultSubactivityLabel={storedSubactivity?.label}
            onPersistSubactivity={persistSubactivity}
            onSubmit={handleUpdateSubmit}
          />
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
              {updates.slice(0, 10).map((update) => {
                const hours = computeTimeWindowHours(update);
                const timeWindow = formatTimeWindow(update);
                return (
                  <li key={update.id} className="space-y-2 rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-base font-semibold text-foreground">{Math.round(update.percent)}%</span>
                      <span className="text-xs text-muted-foreground">{formatDate(update.createdAt, true)}</span>
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
                              {getShiftLabel(item.shift)}
                              {item.weather ? ` • ${getWeatherLabel(item.weather)}` : ""}
                              {item.condition ? ` • ${getConditionLabel(item.condition)}` : ""}
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
                    {update.criticality ? (
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
