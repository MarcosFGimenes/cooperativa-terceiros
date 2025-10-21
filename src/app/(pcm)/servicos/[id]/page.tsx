export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { notFound } from "next/navigation";

import SCurve from "@/components/SCurve";
import { plannedCurve, realizedFromChecklist, realizedFromUpdates } from "@/lib/curve";
import {
  getChecklist,
  getService,
  getServiceById,
  listUpdates,
} from "@/lib/repo/services";
import type { ChecklistItem, ServiceUpdate } from "@/lib/types";

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
    }))
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
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

function normaliseStatus(value: unknown) {
  const raw = String(value ?? "").toLowerCase();
  if (raw === "concluido" || raw === "concluído") return "Concluído";
  if (raw === "encerrado") return "Encerrado";
  return "Aberto";
}

function toDayIso(value: unknown) {
  if (value === null || value === undefined) return null;
  let date: Date | null = null;
  if (typeof value === "number") {
    date = new Date(value);
  } else if (typeof value === "string") {
    date = new Date(value);
  } else if (value instanceof Date) {
    date = value;
  }
  if (!date || Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
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

  const [rawChecklist, rawUpdates] = await Promise.all([
    getChecklist(params.id).catch(() => []),
    listUpdates(params.id, 100).catch(() => []),
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

  const realizedPercent = (() => {
    if (checklist.length > 0) {
      return realizedFromChecklist(checklist);
    }
    if (updates.length > 0) {
      return realizedFromUpdates(updates);
    }
    return normaliseProgress(baseService.progress ?? baseService.realPercent ?? baseService.andamento);
  })();

  const realizedSeries = buildRealizedSeries({
    updates,
    planned,
    realizedPercent,
    plannedStart: baseService.plannedStart || legacyService?.plannedStart,
    plannedEnd: baseService.plannedEnd || legacyService?.plannedEnd,
    createdAt: baseService.createdAt ?? legacyService?.createdAt,
  });

  return (
    <div className="container mx-auto space-y-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Serviço {baseService.os || baseService.code || baseService.id}</h1>
          <p className="text-sm text-muted-foreground">
            Visão geral, andamento e curva S do serviço selecionado.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="btn-secondary" href="/servicos">
            Voltar
          </Link>
          <Link className="btn-primary" href={`/servicos/${baseService.id}/editar`}>
            Editar
          </Link>
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
              <dd className="font-medium">{normaliseProgress(baseService.progress ?? baseService.realPercent ?? baseService.andamento ?? realizedPercent)}%</dd>
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
              {updates.slice(-6).reverse().map((update) => (
                <li key={update.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{Math.round(update.percent ?? 0)}%</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(update.createdAt)}
                    </span>
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
