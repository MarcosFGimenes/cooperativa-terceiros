import { formatDayKey } from "@/lib/formatDateTime";
import { parseDayFirstDateStringToUtcDate, parsePortugueseDateStringToUtcDate } from "@/lib/dateParsing";
import { DEFAULT_TIME_ZONE, startOfDayInTimeZone } from "@/lib/referenceDate";

type DateInput =
  | string
  | number
  | Date
  | { toDate?: () => Date; toMillis?: () => number }
  | { seconds?: number; nanoseconds?: number }
  | { _seconds?: number; _nanoseconds?: number }
  | null
  | undefined;

type UpdateLike = Record<string, unknown>;

type ServiceLike = Record<string, unknown> & {
  updates?: UpdateLike[] | null;
};

type SubpackageLike = Record<string, unknown> & {
  servicos?: ServiceLike[] | null;
  services?: ServiceLike[] | null;
};

type PackageLike = Record<string, unknown> & {
  subpacotes?: SubpackageLike[] | null;
  subPackages?: SubpackageLike[] | null;
};

export type ConsolidatedCurvePoint = { date: string; percent: number };

export type ConsolidatedSCurveResult = {
  timeline: string[];
  plannedSeries: ConsolidatedCurvePoint[];
  realizedSeries: ConsolidatedCurvePoint[];
};

export type BuildConsolidatedSCurveParams = {
  services?: ServiceLike[] | null;
  pacote?: PackageLike | null;
  timeZone?: string;
  referenceDate?: DateInput;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function parseDateInput(value: DateInput): Date | null {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? null : new Date(time);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const brDate = parseDayFirstDateStringToUtcDate(trimmed);
    if (brDate) return brDate;
    const ptDate = parsePortugueseDateStringToUtcDate(trimmed);
    if (ptDate) return ptDate;

    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (value && typeof value === "object") {
    const source = value as { toDate?: () => Date; toMillis?: () => number };
    if (typeof source.toDate === "function") {
      const date = source.toDate();
      if (date instanceof Date && !Number.isNaN(date.getTime())) {
        return new Date(date.getTime());
      }
    }
    if (typeof source.toMillis === "function") {
      const millis = source.toMillis();
      if (typeof millis === "number" && Number.isFinite(millis)) {
        const date = new Date(millis);
        return Number.isNaN(date.getTime()) ? null : date;
      }
    }

    const seconds =
      (value as { seconds?: unknown }).seconds ?? (value as { _seconds?: unknown })._seconds;
    const nanoseconds =
      (value as { nanoseconds?: unknown }).nanoseconds ??
      (value as { _nanoseconds?: unknown })._nanoseconds;
    if (typeof seconds === "number" && Number.isFinite(seconds)) {
      const millis = seconds * 1000 + (typeof nanoseconds === "number" ? nanoseconds / 1_000_000 : 0);
      const date = new Date(millis);
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }

  return null;
}

function toStartOfDay(value: Date, timeZone: string): Date {
  return startOfDayInTimeZone(value, timeZone);
}

function parsePercent(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.min(100, value));
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/%/g, "").trim().replace(",", ".");
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.min(100, parsed));
    }
  }
  return null;
}

const UPDATE_LIST_KEYS = [
  "atualizacoes",
  "historicoAtualizacoes",
  "historico",
  "history",
  "updates",
  "progressUpdates",
  "percentualUpdates",
  "realUpdates",
];

const WORKED_DAY_KEYS = [
  "reportDate",
  "reportDateMillis",
  "date",
  "data",
  "dataTrabalhada",
  "diaTrabalhado",
  "workedDay",
  "workDate",
];

const FALLBACK_DATE_KEYS = [
  "createdAt",
  "updatedAt",
  "submittedAt",
  "timestamp",
  "atualizadoEm",
  "lastUpdateDate",
];

const UPDATE_PERCENT_KEYS = [
  "percentual",
  "percentualInformado",
  "percentualReal",
  "percentualRealAtual",
  "realPercent",
  "andamento",
  "percent",
  "pct",
  "value",
  "valor",
  "progress",
  "manualPercent",
  "realPercentSnapshot",
];

function resolveWorkedDay(update: UpdateLike, timeZone: string): Date | null {
  for (const key of WORKED_DAY_KEYS) {
    if (!Object.hasOwn(update, key)) continue;
    const parsed = parseDateInput(update[key] as DateInput);
    if (parsed) return toStartOfDay(parsed, timeZone);
  }

  const audit = update.audit as Record<string, unknown> | undefined;
  const auditSubmittedAt = audit ? parseDateInput(audit.submittedAt as DateInput) : null;
  if (auditSubmittedAt) return toStartOfDay(auditSubmittedAt, timeZone);

  for (const key of FALLBACK_DATE_KEYS) {
    if (!Object.hasOwn(update, key)) continue;
    const parsed = parseDateInput(update[key] as DateInput);
    if (parsed) return toStartOfDay(parsed, timeZone);
  }

  return null;
}

function resolveUpdateTimestamp(update: UpdateLike): number | null {
  const audit = update.audit as Record<string, unknown> | undefined;
  const auditSubmittedAt = audit ? parseDateInput(audit.submittedAt as DateInput) : null;
  if (auditSubmittedAt) return auditSubmittedAt.getTime();

  const candidates = [
    update.submittedAt,
    update.updatedAt,
    update.createdAt,
    update.timestamp,
    update.atualizadoEm,
  ];

  for (const candidate of candidates) {
    const parsed = parseDateInput(candidate as DateInput);
    if (parsed) return parsed.getTime();
  }

  return null;
}

function resolveUpdatePercent(update: UpdateLike): number | null {
  for (const key of UPDATE_PERCENT_KEYS) {
    if (!Object.hasOwn(update, key)) continue;
    const parsed = parsePercent(update[key]);
    if (parsed !== null) return parsed;
  }
  return null;
}

function collectUpdates(service: ServiceLike): UpdateLike[] {
  const updates: UpdateLike[] = [];

  UPDATE_LIST_KEYS.forEach((key) => {
    const value = service[key];
    if (Array.isArray(value)) {
      updates.push(...(value as UpdateLike[]));
    }
  });

  if (Array.isArray(service.updates)) {
    updates.push(...service.updates);
  }

  return updates;
}

type NormalizedUpdate = {
  day: Date;
  percent: number;
  timestamp: number;
};

function normalizeUpdates(service: ServiceLike, timeZone: string): NormalizedUpdate[] {
  const rawUpdates = collectUpdates(service);
  if (!rawUpdates.length) return [];

  const normalized: NormalizedUpdate[] = [];

  rawUpdates.forEach((update, index) => {
    if (!update || typeof update !== "object") return;
    const day = resolveWorkedDay(update, timeZone);
    if (!day) return;
    const percent = resolveUpdatePercent(update);
    if (percent === null) return;
    const timestamp = resolveUpdateTimestamp(update) ?? day.getTime() + index;
    normalized.push({ day, percent, timestamp });
  });

  if (!normalized.length) return [];

  normalized.sort((a, b) => {
    const dayDiff = a.day.getTime() - b.day.getTime();
    if (dayDiff !== 0) return dayDiff;
    return a.timestamp - b.timestamp;
  });

  const byDay = new Map<string, NormalizedUpdate>();
  normalized.forEach((entry) => {
    const key = formatDayKey(entry.day, { timeZone, fallback: entry.day.toISOString().slice(0, 10) });
    byDay.set(key, entry);
  });

  return Array.from(byDay.values()).sort((a, b) => a.day.getTime() - b.day.getTime());
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.trim().replace("%", "").replace(",", ".");
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function resolveServiceHours(service: ServiceLike): number | null {
  const candidates = [
    service.totalHours,
    service.horasPrevistas,
    service.horas,
    service.hours,
    service.peso,
    service.weight,
    service.totalHoras,
  ];
  for (const candidate of candidates) {
    const parsed = parseNumber(candidate);
    if (parsed !== null && parsed > 0) return parsed;
  }
  return null;
}

function resolveServiceStart(service: ServiceLike): Date | null {
  const candidates = [
    service.dataInicio,
    service.inicioPrevisto,
    service.inicioPlanejado,
    service.plannedStart,
    service.startDate,
  ];
  for (const candidate of candidates) {
    const parsed = parseDateInput(candidate as DateInput);
    if (parsed) return parsed;
  }
  return null;
}

function resolveServiceEnd(service: ServiceLike): Date | null {
  const candidates = [
    service.dataFim,
    service.fimPrevisto,
    service.fimPlanejado,
    service.plannedEnd,
    service.endDate,
  ];
  for (const candidate of candidates) {
    const parsed = parseDateInput(candidate as DateInput);
    if (parsed) return parsed;
  }
  return null;
}

function collectServices(params: BuildConsolidatedSCurveParams): ServiceLike[] {
  if (Array.isArray(params.services)) {
    return params.services as ServiceLike[];
  }

  const pacote = params.pacote;
  if (!pacote) return [];

  const subpackages =
    (pacote.subpacotes ?? pacote.subPackages ?? []).filter(Boolean) as SubpackageLike[];

  return subpackages.flatMap((sub) => {
    const fromServicos = Array.isArray(sub.servicos) ? sub.servicos : [];
    const fromServices = Array.isArray(sub.services) ? sub.services : [];
    return [...fromServicos, ...fromServices];
  });
}

function buildTimeline(services: ServiceLike[], timeZone: string): Date[] {
  const starts: Date[] = [];
  const ends: Date[] = [];

  services.forEach((service) => {
    const start = resolveServiceStart(service);
    const end = resolveServiceEnd(service);
    if (start) starts.push(toStartOfDay(start, timeZone));
    if (end) ends.push(toStartOfDay(end, timeZone));
  });

  if (!starts.length && !ends.length) return [];

  const startDate = starts.length
    ? starts.reduce((min, current) => (current.getTime() < min.getTime() ? current : min))
    : ends.reduce((min, current) => (current.getTime() < min.getTime() ? current : min));

  const endDate = ends.length
    ? ends.reduce((max, current) => (current.getTime() > max.getTime() ? current : max))
    : starts.reduce((max, current) => (current.getTime() > max.getTime() ? current : max));

  const orderedStart = startDate.getTime() <= endDate.getTime() ? startDate : endDate;
  const orderedEnd = startDate.getTime() <= endDate.getTime() ? endDate : startDate;

  const timeline: Date[] = [];
  for (
    let cursor = orderedStart;
    cursor.getTime() <= orderedEnd.getTime();
    cursor = toStartOfDay(new Date(cursor.getTime() + DAY_IN_MS), timeZone)
  ) {
    timeline.push(cursor);
  }

  return timeline;
}

function calcPlannedPercentForService(day: Date, start: Date | null, end: Date | null, timeZone: string): number {
  if (!start || !end) return 0;
  const startDay = toStartOfDay(start, timeZone).getTime();
  const endDay = toStartOfDay(end, timeZone).getTime();
  const targetDay = day.getTime();

  if (targetDay < Math.min(startDay, endDay)) return 0;

  const orderedStart = Math.min(startDay, endDay);
  const orderedEnd = Math.max(startDay, endDay);
  const totalDays = Math.floor((orderedEnd - orderedStart) / DAY_IN_MS) + 1;

  if (totalDays <= 1) return 100;
  if (targetDay >= orderedEnd) return 100;

  const daysInto = Math.floor((targetDay - orderedStart) / DAY_IN_MS) + 1;
  const percent = (daysInto / totalDays) * 100;
  return Math.max(0, Math.min(100, percent));
}

function forwardFillSeries(timeline: Date[], updates: NormalizedUpdate[]): number[] {
  const results: number[] = [];
  let lastPercent = 0;
  let updateIndex = 0;

  for (const day of timeline) {
    while (updateIndex < updates.length && updates[updateIndex].day.getTime() <= day.getTime()) {
      lastPercent = updates[updateIndex].percent;
      updateIndex += 1;
    }
    results.push(lastPercent);
  }

  return results;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function buildConsolidatedSCurve({
  services: rawServices,
  pacote,
  timeZone = DEFAULT_TIME_ZONE,
}: BuildConsolidatedSCurveParams): ConsolidatedSCurveResult {
  const services = rawServices ?? collectServices({ pacote, timeZone });
  if (!services.length) {
    return { timeline: [], plannedSeries: [], realizedSeries: [] };
  }

  const timeline = buildTimeline(services, timeZone);
  if (!timeline.length) {
    return { timeline: [], plannedSeries: [], realizedSeries: [] };
  }

  const serviceSnapshots = services.map((service) => {
    const hours = resolveServiceHours(service);
    const start = resolveServiceStart(service);
    const end = resolveServiceEnd(service);
    const updates = normalizeUpdates(service, timeZone);
    return { hours, start, end, updates };
  });

  const hoursTotal = serviceSnapshots.reduce((total, service) => {
    if (typeof service.hours === "number" && Number.isFinite(service.hours) && service.hours > 0) {
      return total + service.hours;
    }
    return total;
  }, 0);

  const plannedSeries: ConsolidatedCurvePoint[] = [];
  const realizedSeries: ConsolidatedCurvePoint[] = [];

  const serviceRealizedSeries = serviceSnapshots.map((service) =>
    forwardFillSeries(timeline, service.updates),
  );

  timeline.forEach((day, index) => {
    const dayKey = formatDayKey(day, { timeZone, fallback: day.toISOString().slice(0, 10) });

    let plannedWeighted = 0;
    let realizedWeighted = 0;

    serviceSnapshots.forEach((service, serviceIndex) => {
      if (typeof service.hours !== "number" || !Number.isFinite(service.hours) || service.hours <= 0) {
        return;
      }

      const planned = calcPlannedPercentForService(day, service.start, service.end, timeZone);
      const realized = serviceRealizedSeries[serviceIndex]?.[index] ?? 0;
      plannedWeighted += planned * service.hours;
      realizedWeighted += realized * service.hours;
    });

    const plannedPercent = hoursTotal > 0 ? plannedWeighted / hoursTotal : 0;
    const realizedPercent = hoursTotal > 0 ? realizedWeighted / hoursTotal : 0;

    plannedSeries.push({ date: dayKey, percent: clampPercent(plannedPercent) });
    realizedSeries.push({ date: dayKey, percent: clampPercent(realizedPercent) });
  });

  return {
    timeline: timeline.map((day) =>
      formatDayKey(day, { timeZone, fallback: day.toISOString().slice(0, 10) }),
    ),
    plannedSeries,
    realizedSeries,
  };
}
