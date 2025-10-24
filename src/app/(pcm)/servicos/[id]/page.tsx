export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";

import SCurve from "@/components/SCurve";
import { plannedCurve, realizedFromChecklist, realizedFromUpdates } from "@/lib/curve";
import { getLatestServiceToken } from "@/lib/repo/accessTokens";
import {
  getChecklist,
  getService,
  getServiceById,
  listUpdates,
} from "@/lib/repo/services";
import type { ChecklistItem, ServiceUpdate } from "@/lib/types";
import DeleteServiceButton from "@/components/DeleteServiceButton";

function toNewChecklist(items: ChecklistItem[]): ChecklistItem[] {
  return items.map((item) => {
    const status = (() => {
      const raw = String(item.status ?? "").toLowerCase();
      if (raw === "em-andamento" || raw === "andamento") return "em-andamento" as const;
      if (raw === "concluido" || raw === "concluído") return "concluido" as const;
      return "nao-iniciado" as const;
    })();
    return {
      ...item,
      status,
      progress: Math.max(0, Math.min(100, Math.round(item.progress ?? 0))),
      weight: Math.max(0, Math.min(100, Math.round(item.weight ?? 0))),
    };
  });
}

function toNewUpdates(updates: ServiceUpdate[]): ServiceUpdate[] {
  return updates
    .map((update) => ({
      ...update,
      percent: update.percent ?? update.manualPercent ?? update.realPercentSnapshot ?? 0,
      timeWindow: update.timeWindow,
      subactivity: update.subactivity,
      impediments: update.impediments,
      resources: update.resources,
      evidences: update.evidences,
      justification: update.justification,
      criticality: update.criticality,
    }))
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

function normaliseProgress(value?: number | null) {
  if (!Number.isFinite(value ?? NaN)) return 0;
  return Math.max(0, Math.min(100, Math.round(Number(value ?? 0))));
}

function formatDate(value: string | number | undefined) {
  if (!value) return "-";
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function formatDateTime(value: string | number | undefined) {
  if (!value) return "-";
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function normaliseStatus(value: unknown) {
  const raw = String(value ?? "").toLowerCase();
  if (raw === "concluido" || raw === "concluído") return "Concluído";
  if (raw === "encerrado") return "Encerrado";
  return "Aberto";
}

function formatTimeWindow(update: ServiceUpdate): string | null {
  const startRaw = update.timeWindow?.start;
  const endRaw = update.timeWindow?.end;
  if (startRaw === null || startRaw === undefined || endRaw === null || endRaw === undefined) {
    return null;
  }
  const startDate = new Date(startRaw as string | number);
  const endDate = new Date(endRaw as string | number);
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

function computeTimeWindowHours(update: ServiceUpdate): number | null {
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
  const startRaw = update.timeWindow?.start;
  const endRaw = update.timeWindow?.end;
  if (startRaw === null || startRaw === undefined || endRaw === null || endRaw === undefined) {
    return null;
  }
  const startDate = new Date(startRaw as string | number);
  const endDate = new Date(endRaw as string | number);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
  const diff = (endDate.getTime() - startDate.getTime()) / 3_600_000;
  if (!Number.isFinite(diff) || diff < 0) return null;
  return Math.round(diff * 100) / 100;
}

function toDayIso(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  let date: Date | null = null;
  if (typeof value === "number") {
    date = new Date(value);
  } else if (typeof value === "string") {
    date = new Date(value);
  } else if (value instanceof Date) {
    date = value;
  }
  if (!date || Number.isNaN(date.getTime())) return null;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildRealizedSeries(params: {
  updates: ServiceUpdate[];
  planned: ReturnType<typeof plannedCurve>;
  realizedPercent: number;
  plannedStart?: string;
  plannedEnd?: string;
  createdAt?: number;
}) {
  const points = new Map<string, number>();

  params.updates.forEach((update) => {
    const day = toDayIso(update.createdAt);
    if (!day) return;
    points.set(day, normaliseProgress(update.percent));
  });

  if (points.size > 0) {
    return Array.from(points.entries())
      .sort((a, b) => {
        const aTime = new Date(a[0]).getTime();
        const bTime = new Date(b[0]).getTime();
        if (Number.isNaN(aTime) || Number.isNaN(bTime)) return a[0].localeCompare(b[0]);
        return aTime - bTime;
      })
      .map(([date, percent]) => ({ date, percent }));
  }

  const plannedStart = toDayIso(params.plannedStart) ?? params.planned[0]?.date ?? toDayIso(params.createdAt);
  const plannedEnd =
    toDayIso(params.plannedEnd) ?? params.planned[params.planned.length - 1]?.date ?? toDayIso(new Date());

  if (!plannedStart && !plannedEnd) {
    return [];
  }

  const start = plannedStart ?? plannedEnd!;
  const end = plannedEnd ?? plannedStart!;
  const realised = normaliseProgress(params.realizedPercent);

  if (start === end) {
    return [
      { date: start, percent: 0 },
      { date: end, percent: realised },
    ];
  }

  return [
    { date: start, percent: 0 },
    { date: end, percent: realised },
  ];
}

export default async function ServiceDetailPage({ params }: { params: { id: string } }) {
  const [service, legacyService] = await Promise.all([
    getServiceById(params.id),
    getService(params.id),
  ]);

  const baseService = service ?? legacyService;
  if (!baseService) return notFound();

  const [rawChecklist, rawUpdates, latestToken] = await Promise.all([
    getChecklist(params.id).catch(() => []),
    listUpdates(params.id, 100).catch(() => []),
    getLatestServiceToken(baseService.id).catch((error) => {
      console.error(`[servicos/${baseService.id}] Falha ao carregar token mais recente`, error);
      return null;
    }),
  ]);

  const checklist = baseService.checklist?.length
    ? toNewChecklist(baseService.checklist)
    : toNewChecklist(rawChecklist);
  const updates = baseService.updates?.length
    ? toNewUpdates(baseService.updates)
    : toNewUpdates(rawUpdates);

  const totalHours = Number.isFinite(baseService.totalHours)
    ? Number(baseService.totalHours)
    : Number(legacyService?.totalHours ?? 0);

  const planned = plannedCurve(
    baseService.plannedStart || legacyService?.plannedStart || new Date().toISOString(),
    baseService.plannedEnd || legacyService?.plannedEnd || new Date().toISOString(),
    totalHours > 0 ? totalHours : 1,
  );

  const checklistPercent = checklist.length > 0 ? realizedFromChecklist(checklist) : null;
  const updatesPercent = updates.length > 0 ? realizedFromUpdates(updates) : null;
  const baselinePercent = [
    baseService.manualPercent,
    baseService.progress,
    baseService.realPercent,
    baseService.andamento,
    legacyService?.manualPercent,
    legacyService?.progress,
    legacyService?.realPercent,
    legacyService?.andamento,
  ].reduce((acc, value) => {
    const numeric =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number(value)
          : null;
    if (!Number.isFinite(numeric ?? NaN)) return acc;
    return Math.max(acc, normaliseProgress(numeric ?? 0));
  }, 0);

  const realizedPercent = Math.max(baselinePercent, checklistPercent ?? 0, updatesPercent ?? 0);

  const realizedSeries = buildRealizedSeries({
    updates,
    planned,
    realizedPercent,
    plannedStart: baseService.plannedStart || legacyService?.plannedStart,
    plannedEnd: baseService.plannedEnd || legacyService?.plannedEnd,
    createdAt: baseService.createdAt ?? legacyService?.createdAt,
  });

  const serviceLabel = baseService.os || baseService.code || baseService.id;
  const tokenLink = latestToken ? `/acesso?token=${latestToken.code}` : null;

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
          <Link className="btn btn-primary" href={`/servicos/${baseService.id}/editar`}>
            <Pencil aria-hidden="true" className="h-4 w-4" />
            Editar
          </Link>
          <DeleteServiceButton serviceId={baseService.id} serviceLabel={serviceLabel} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_minmax(320px,380px)]">
        <div className="card p-4">
          <h2 className="mb-4 text-lg font-semibold">Informações gerais</h2>
          <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="font-medium">{normaliseStatus(baseService.status)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Andamento</dt>
              <dd className="font-medium">{Math.round(realizedPercent)}%</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Tag</dt>
              <dd className="font-medium">{baseService.tag || "-"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Equipamento</dt>
              <dd className="font-medium">{baseService.equipmentName || "-"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Setor</dt>
              <dd className="font-medium">{baseService.setor || baseService.sector || "-"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Horas Totais</dt>
              <dd className="font-medium">{totalHours || "-"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Início planejado</dt>
              <dd className="font-medium">{formatDate(baseService.plannedStart || legacyService?.plannedStart)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Fim planejado</dt>
              <dd className="font-medium">{formatDate(baseService.plannedEnd || legacyService?.plannedEnd)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Empresa atribuída</dt>
              <dd className="font-medium">{baseService.assignedTo?.companyName || baseService.assignedTo?.companyId || baseService.company || baseService.empresa || "-"}</dd>
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
                      {latestToken.company ? (
                        <span>Empresa vinculada: {latestToken.company}</span>
                      ) : null}
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
          {updates.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Nenhuma atualização registrada.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {updates.slice(0, 6).map((update) => {
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
                    {Array.isArray(update.impediments) && update.impediments.length > 0 ? (
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
                    {Array.isArray(update.resources) && update.resources.length > 0 ? (
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
                    {Array.isArray(update.evidences) && update.evidences.length > 0 ? (
                      <div className="text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">Evidências:</span>
                        <ul className="mt-1 space-y-1">
                          {update.evidences.map((item, index) => (
                            <li key={index}>
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary underline"
                              >
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
