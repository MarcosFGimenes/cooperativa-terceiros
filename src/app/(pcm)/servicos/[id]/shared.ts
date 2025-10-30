import { realizedFromChecklist, realizedFromUpdates } from "@/lib/curve";
import type {
  ChecklistItem,
  Service,
  ServiceUpdate,
} from "@/lib/types";
import type {
  DocumentData,
  DocumentSnapshot,
  QueryDocumentSnapshot,
} from "firebase/firestore";

export type ServiceRealtimeData = {
  id: string;
  os?: string | null;
  code?: string | null;
  oc?: string | null;
  tag?: string | null;
  equipmentName?: string | null;
  sector?: string | null;
  setor?: string | null;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  totalHours?: number | null;
  status?: string | null;
  andamento?: number | null;
  realPercent?: number | null;
  manualPercent?: number | null;
  progress?: number | null;
  assignedTo?: { companyId?: string; companyName?: string } | null;
  company?: string | null;
  empresa?: string | null;
  createdAt?: number | null;
  updatedAt?: number | null;
  hasChecklist?: boolean | null;
};

type PlannedPoint = { date: string; percent: number; hoursAccum?: number };

type FirestoreLikeTimestamp = { toMillis?: () => number } | { seconds?: number; nanoseconds?: number };

type ServiceRecord = Record<string, unknown>;

const DEFAULT_TIME_ZONE = "America/Sao_Paulo";

type FirestoreAudit = {
  submittedBy?: string | null;
  submittedByType?: "token" | "user" | "system" | string | null;
  submittedAt?: unknown;
  previousPercent?: unknown;
  newPercent?: unknown;
  token?: unknown;
  ip?: unknown;
};

export function toMillis(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.getTime();
    }
  }
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? null : time;
  }
  if (typeof value === "object") {
    const maybe = value as FirestoreLikeTimestamp & { toDate?: () => Date };
    if (typeof maybe?.toMillis === "function") {
      const millis = maybe.toMillis();
      if (typeof millis === "number" && Number.isFinite(millis)) {
        return millis;
      }
    }
    if (typeof maybe?.toDate === "function") {
      const date = maybe.toDate();
      if (date instanceof Date && !Number.isNaN(date.getTime())) {
        return date.getTime();
      }
    }
    if (typeof maybe?.seconds === "number") {
      const millis = maybe.seconds * 1000 + Math.round((maybe.nanoseconds ?? 0) / 1_000_000);
      if (Number.isFinite(millis)) {
        return millis;
      }
    }
  }
  return null;
}

export function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toOptionalString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function toIsoDate(value: unknown): string | null {
  const millis = toMillis(value);
  if (millis === null) return null;
  const date = new Date(millis);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function pickDateField(data: ServiceRecord, keys: string[]): string | null {
  for (const key of keys) {
    if (!(key in data)) continue;
    const iso = toIsoDate(data[key]);
    if (iso) return iso;
  }
  return null;
}

export function composeServiceRealtimeData(
  primary: Partial<Service> | null | undefined,
  fallback?: Partial<Service> | null,
): ServiceRealtimeData {
  const base: ServiceRealtimeData = {
    id: String(primary?.id ?? fallback?.id ?? ""),
    os: primary?.os ?? fallback?.os ?? null,
    code: primary?.code ?? fallback?.code ?? null,
    oc: primary?.oc ?? fallback?.oc ?? null,
    tag: primary?.tag ?? fallback?.tag ?? null,
    equipmentName: primary?.equipmentName ?? fallback?.equipmentName ?? null,
    sector: primary?.sector ?? fallback?.sector ?? null,
    setor: primary?.setor ?? fallback?.setor ?? null,
    plannedStart: primary?.plannedStart ?? fallback?.plannedStart ?? null,
    plannedEnd: primary?.plannedEnd ?? fallback?.plannedEnd ?? null,
    totalHours:
      typeof primary?.totalHours === "number"
        ? primary?.totalHours
        : typeof fallback?.totalHours === "number"
          ? fallback.totalHours
          : null,
    status: primary?.status ?? fallback?.status ?? null,
    andamento: primary?.andamento ?? fallback?.andamento ?? null,
    realPercent: primary?.realPercent ?? fallback?.realPercent ?? null,
    manualPercent: primary?.manualPercent ?? fallback?.manualPercent ?? null,
    progress: primary?.progress ?? fallback?.progress ?? null,
    assignedTo: primary?.assignedTo ?? fallback?.assignedTo ?? null,
    company: primary?.company ?? fallback?.company ?? null,
    empresa: primary?.empresa ?? fallback?.empresa ?? null,
    createdAt: primary?.createdAt ?? fallback?.createdAt ?? null,
    updatedAt: primary?.updatedAt ?? fallback?.updatedAt ?? null,
    hasChecklist: primary?.hasChecklist ?? fallback?.hasChecklist ?? null,
  };

  if (!base.plannedStart && typeof primary?.createdAt === "number") {
    base.plannedStart = new Date(primary.createdAt).toISOString();
  }

  return base;
}

export function mergeServiceRealtime(
  current: ServiceRealtimeData,
  next: Partial<ServiceRealtimeData>,
): ServiceRealtimeData {
  return {
    ...current,
    ...next,
    assignedTo: next.assignedTo ?? current.assignedTo ?? null,
  };
}

export function mapServiceSnapshot(
  snapshot: DocumentSnapshot<DocumentData>,
): Partial<ServiceRealtimeData> {
  if (!snapshot.exists()) return {};
  const data = (snapshot.data() ?? {}) as ServiceRecord;
  const plannedStart = pickDateField(data, [
    "plannedStart",
    "inicioPrevisto",
    "inicioPlanejado",
    "dataInicio",
    "startDate",
  ]);
  const plannedEnd = pickDateField(data, [
    "plannedEnd",
    "fimPrevisto",
    "fimPlanejado",
    "dataFim",
    "endDate",
  ]);

  const assignedRaw = data.assignedTo;
  const assignedTo =
    assignedRaw && typeof assignedRaw === "object"
      ? {
          companyId: toOptionalString((assignedRaw as ServiceRecord).companyId ?? (assignedRaw as ServiceRecord).empresaId) ?? undefined,
          companyName: toOptionalString((assignedRaw as ServiceRecord).companyName ?? (assignedRaw as ServiceRecord).empresaNome) ?? undefined,
        }
      : null;

  const companyCandidates = [
    data.company,
    data.companyId,
    data.empresa,
    data.empresaId,
  ];
  const company = companyCandidates.map(toOptionalString).find((value) => value) ?? null;

  return {
    id: snapshot.id,
    os: toOptionalString(data.os) ?? null,
    code: toOptionalString(data.code) ?? null,
    oc: toOptionalString(data.oc) ?? null,
    tag: toOptionalString(data.tag) ?? null,
    equipmentName:
      toOptionalString(data.equipmentName ?? data.equipamento ?? data.equipment) ?? null,
    sector: toOptionalString(data.sector) ?? null,
    setor: toOptionalString(data.setor) ?? null,
    plannedStart,
    plannedEnd,
    totalHours:
      toNumber(
        data.totalHours ?? data.totalHoras ?? data.horasTotais ?? data.horasPrevistas ?? data.hours,
      ) ?? null,
    status: toOptionalString(data.status) ?? null,
    andamento: toNumber(data.andamento ?? data.progress) ?? null,
    realPercent: toNumber(data.realPercent) ?? null,
    manualPercent: toNumber(data.manualPercent) ?? null,
    progress: toNumber(data.progress) ?? null,
    assignedTo,
    company,
    empresa: toOptionalString(data.empresa) ?? null,
    createdAt: toMillis(data.createdAt) ?? null,
    updatedAt: toMillis(data.updatedAt) ?? null,
    hasChecklist: data.hasChecklist === true || Array.isArray(data.checklist) ? true : null,
  };
}

function mapChecklistStatus(value: unknown): ChecklistItem["status"] {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
  if (raw === "concluido" || raw === "concluído") return "concluido";
  if (raw === "em-andamento" || raw === "andamento") return "em-andamento";
  return "nao-iniciado";
}

export function mapChecklistSnapshot(
  doc: QueryDocumentSnapshot<DocumentData>,
): ChecklistItem {
  const data = (doc.data() ?? {}) as ServiceRecord;
  return {
    id: String(data.id ?? data.itemId ?? doc.id),
    description: String(data.description ?? data.descricao ?? ""),
    weight: toNumber(data.weight ?? data.peso) ?? 0,
    progress: toNumber(data.progress ?? data.percentual ?? data.pct) ?? 0,
    status: mapChecklistStatus(data.status),
    serviceId: String(data.serviceId ?? doc.ref.parent.parent?.id ?? ""),
    updatedAt: toMillis(data.updatedAt) ?? undefined,
  };
}

function mapTimeWindow(raw: unknown): ServiceUpdate["timeWindow"] {
  if (!raw || typeof raw !== "object") return undefined;
  const record = raw as ServiceRecord;
  const start = toMillis(record.start);
  const end = toMillis(record.end);
  const hours = toNumber(record.hours);
  if (start === null && end === null && hours === null) return undefined;
  return {
    start: start ?? undefined,
    end: end ?? undefined,
    hours: hours ?? undefined,
  };
}

function mapSubactivity(raw: unknown): ServiceUpdate["subactivity"] {
  if (!raw || typeof raw !== "object") return undefined;
  const record = raw as ServiceRecord;
  const id = toOptionalString(record.id);
  const label = toOptionalString(record.label ?? record.name ?? record.descricao);
  if (!id && !label) return undefined;
  return { id: id ?? undefined, label: label ?? undefined };
}

function mapImpediments(raw: unknown): ServiceUpdate["impediments"] {
  if (!Array.isArray(raw)) return undefined;
  const items = raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as ServiceRecord;
      const type = toOptionalString(record.type ?? record.description);
      if (!type) return null;
      const duration = toNumber(record.durationHours ?? record.duration ?? record.horas);
      return { type, durationHours: duration ?? null };
    })
    .filter(Boolean);
  return items.length ? (items as Array<{ type: string; durationHours?: number | null }>) : undefined;
}

function mapResources(raw: unknown): ServiceUpdate["resources"] {
  if (!Array.isArray(raw)) return undefined;
  const items = raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as ServiceRecord;
      const name = toOptionalString(record.name ?? record.recurso ?? record.descricao);
      if (!name) return null;
      const quantity = toNumber(record.quantity ?? record.quantidade);
      const unit = toOptionalString(record.unit ?? record.unidade);
      return {
        name,
        quantity: quantity ?? null,
        unit: unit ?? null,
      };
    })
    .filter(Boolean);
  return items.length ? (items as Array<{ name: string; quantity?: number | null; unit?: string | null }>) : undefined;
}

function mapWorkforce(raw: unknown): ServiceUpdate["workforce"] {
  if (!Array.isArray(raw)) return undefined;
  const items = raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as ServiceRecord;
      const role = toOptionalString(record.role ?? record.funcao ?? record.tipo);
      if (!role) return null;
      const quantity = toNumber(record.quantity ?? record.quantidade ?? record.qtd);
      if (!Number.isFinite(quantity ?? NaN)) return null;
      return {
        role,
        quantity: Math.max(1, Math.round(Number(quantity))),
      };
    })
    .filter(Boolean);
  return items.length ? (items as Array<{ role: string; quantity: number }>) : undefined;
}

function mapShiftConditions(raw: unknown): ServiceUpdate["shiftConditions"] {
  if (!Array.isArray(raw)) return undefined;
  const items = raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as ServiceRecord;
      const shift = toOptionalString(record.shift ?? record.turno)?.toLowerCase();
      const weather = toOptionalString(record.weather ?? record.clima)?.toLowerCase();
      const condition = toOptionalString(record.condition ?? record.condicao)?.toLowerCase();
      if (!shift || !weather || !condition) return null;
      return { shift: shift as "manha" | "tarde" | "noite", weather: weather as "claro" | "nublado" | "chuvoso", condition: condition as "praticavel" | "impraticavel" };
    })
    .filter(Boolean);
  return items.length
    ? (items as Array<{ shift: "manha" | "tarde" | "noite"; weather: "claro" | "nublado" | "chuvoso"; condition: "praticavel" | "impraticavel" }> )
    : undefined;
}

function mapEvidences(raw: unknown): ServiceUpdate["evidences"] {
  if (!Array.isArray(raw)) return undefined;
  const items = raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as ServiceRecord;
      const url = toOptionalString(record.url ?? record.link);
      if (!url) return null;
      const label = toOptionalString(record.label ?? record.nome ?? record.descricao);
      return { url, label };
    })
    .filter(Boolean);
  return items.length ? (items as Array<{ url: string; label?: string | null }>) : undefined;
}

function mapAudit(raw: unknown): ServiceUpdate["audit"] {
  if (!raw || typeof raw !== "object") return undefined;
  const record = raw as FirestoreAudit;
  const submittedByType = (() => {
    if (typeof record.submittedByType !== "string") return undefined;
    const normalized = record.submittedByType.trim().toLowerCase();
    if (normalized === "token" || normalized === "user" || normalized === "system") {
      return normalized as "token" | "user" | "system";
    }
    return undefined;
  })();

  return {
    submittedBy: toOptionalString(record.submittedBy) ?? null,
    submittedByType,
    submittedAt: toMillis(record.submittedAt) ?? null,
    previousPercent: toNumber(record.previousPercent) ?? null,
    newPercent: toNumber(record.newPercent) ?? null,
    token: toOptionalString(record.token) ?? null,
    ip: toOptionalString(record.ip) ?? null,
  };
}

export function mapUpdateSnapshot(
  doc: QueryDocumentSnapshot<DocumentData>,
): ServiceUpdate {
  const data = (doc.data() ?? {}) as ServiceRecord;
  const manualPercent = toNumber(data.manualPercent) ?? undefined;
  const realPercent = toNumber(data.realPercentSnapshot ?? data.realPercent ?? data.percent) ?? manualPercent ?? 0;
  const description = (() => {
    const raw = data.description ?? data.note ?? data.observacao;
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      return trimmed.length ? trimmed : "";
    }
    return "";
  })();

  return {
    id: doc.id,
    serviceId: doc.ref.parent.parent?.id,
    token: toOptionalString(data.token) ?? undefined,
    manualPercent,
    realPercentSnapshot: realPercent,
    percent: realPercent,
    description,
    timeWindow: mapTimeWindow(data.timeWindow ?? data.periodo),
    subactivity: mapSubactivity(data.subactivity ?? data.etapa),
    mode:
      typeof data.mode === "string" && (data.mode === "detailed" || data.mode === "simple")
        ? (data.mode as "simple" | "detailed")
        : undefined,
    impediments: mapImpediments(data.impediments),
    resources: mapResources(data.resources),
    workforce: mapWorkforce(data.workforce),
    shiftConditions: mapShiftConditions(data.shiftConditions),
    forecastDate: toMillis(data.forecastDate) ?? null,
    criticality: toNumber(data.criticality) ?? null,
    evidences: mapEvidences(data.evidences),
    justification:
      typeof data.justification === "string" ? data.justification.trim() || null : null,
    previousPercent: toNumber(data.previousPercent) ?? null,
    declarationAccepted:
      typeof data.declarationAccepted === "boolean" ? data.declarationAccepted : undefined,
    audit: mapAudit(data.audit),
    createdAt: toMillis(data.createdAt) ?? 0,
  };
}

export function normaliseStatus(value: unknown): "Aberto" | "Concluído" | "Encerrado" {
  const raw = String(value ?? "").toLowerCase();
  if (raw === "concluido" || raw === "concluído") return "Concluído";
  if (raw === "encerrado") return "Encerrado";
  return "Aberto";
}

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: DEFAULT_TIME_ZONE });
const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: DEFAULT_TIME_ZONE,
});
const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: DEFAULT_TIME_ZONE,
});

export function formatDate(value?: number | string | Date | null): string {
  if (value === null || value === undefined) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  try {
    return dateFormatter.format(date);
  } catch (error) {
    console.warn("[service-shared] Falha ao formatar data", error);
    return "-";
  }
}

export function formatDateTime(value?: number | string | Date | null): string {
  if (value === null || value === undefined) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  try {
    return dateTimeFormatter.format(date);
  } catch (error) {
    console.warn("[service-shared] Falha ao formatar data/hora", error);
    return "-";
  }
}

function toDayIso(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const millis = toMillis(value);
  if (millis === null) return null;
  const date = new Date(millis);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatTimeWindow(update: ServiceUpdate): string | null {
  const start = update.timeWindow?.start;
  const end = update.timeWindow?.end;
  if (start === null || start === undefined || end === null || end === undefined) {
    return null;
  }
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
  const startKey = dayKeyFormatter.format(startDate);
  const endKey = dayKeyFormatter.format(endDate);
  const sameDay = startKey === endKey;
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: sameDay ? undefined : "short",
    timeStyle: "short",
    timeZone: DEFAULT_TIME_ZONE,
  });
  const startLabel = formatter.format(startDate);
  const endLabel = formatter.format(endDate);
  if (sameDay) {
    const dateLabel = dateFormatter.format(startDate);
    return `${dateLabel}, ${startLabel} - ${endLabel}`;
  }
  return `${startLabel} → ${endLabel}`;
}

export function computeTimeWindowHours(update: ServiceUpdate): number | null {
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

export function normaliseProgress(value?: number | null): number {
  if (!Number.isFinite(value ?? NaN)) return 0;
  return Math.max(0, Math.min(100, Math.round(Number(value ?? 0))));
}

export function toNewChecklist(items: ChecklistItem[]): ChecklistItem[] {
  return items.map((item) => {
    const status = mapChecklistStatus(item.status);
    return {
      ...item,
      status,
      progress: normaliseProgress(item.progress),
      weight: normaliseProgress(item.weight),
    };
  });
}

export function toNewUpdates(updates: ServiceUpdate[]): ServiceUpdate[] {
  return updates
    .map((update) => ({
      ...update,
      percent: update.percent ?? update.manualPercent ?? update.realPercentSnapshot ?? 0,
    }))
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

export function buildRealizedSeries(params: {
  updates: ServiceUpdate[];
  planned: PlannedPoint[];
  realizedPercent: number;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  createdAt?: number | null;
}): Array<{ date: string; percent: number }> {
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

  const plannedStart = params.plannedStart ?? params.planned[0]?.date ?? toDayIso(params.createdAt);
  const plannedEndFromData = params.plannedEnd ?? params.planned[params.planned.length - 1]?.date ?? null;

  const start = plannedStart ?? plannedEndFromData;
  const end = plannedEndFromData ?? plannedStart;

  if (!start || !end) {
    return [];
  }
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

export function deriveRealizedPercent(
  service: ServiceRealtimeData,
  checklist: ChecklistItem[],
  updates: ServiceUpdate[],
): number {
  const baselineSources = [
    service.manualPercent,
    service.progress,
    service.realPercent,
    service.andamento,
  ];
  const baseline = baselineSources.reduce((acc, value) => {
    const numeric = toNumber(value);
    if (!Number.isFinite(numeric ?? NaN)) return acc;
    return Math.max(acc, normaliseProgress(numeric ?? 0));
  }, 0);

  const checklistPercent = checklist.length ? realizedFromChecklist(checklist) : null;
  const updatesPercent = updates.length ? realizedFromUpdates(updates) : null;

  return Math.max(baseline, checklistPercent ?? 0, updatesPercent ?? 0);
}
