const DATE_INPUT_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_REFERENCE_TIME_ZONE = "America/Sao_Paulo";
export const DEFAULT_REFERENCE_DATE_PARAM = "refDate";

type ResolveOptions = {
  value?: string | null;
  timeZone?: string;
  mode?: "start" | "end";
};

type SearchParams =
  | URLSearchParams
  | Record<string, string | string[] | undefined>
  | undefined;

function isValidDateInput(value?: string | null): value is string {
  return typeof value === "string" && DATE_INPUT_REGEX.test(value);
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const localized = new Date(date.toLocaleString("en-US", { timeZone }));
  return localized.getTime() - date.getTime();
}

function buildDateFromInput(value: string, timeZone: string, mode: "start" | "end"): Date {
  const baseUtc = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(baseUtc.getTime())) {
    return new Date();
  }
  const offset = getTimeZoneOffsetMs(baseUtc, timeZone);
  const startOfDayUtc = baseUtc.getTime() - offset;
  if (mode === "end") {
    return new Date(startOfDayUtc + DAY_IN_MS - 1);
  }
  return new Date(startOfDayUtc);
}

export function formatDateInput(value: Date, timeZone = DEFAULT_REFERENCE_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

export function getTodayReferenceInput(timeZone = DEFAULT_REFERENCE_TIME_ZONE): string {
  return formatDateInput(new Date(), timeZone);
}

export function resolveReferenceDate({ value, timeZone = DEFAULT_REFERENCE_TIME_ZONE, mode = "end" }: ResolveOptions = {}) {
  const normalized = isValidDateInput(value) ? value : null;
  const inputValue = normalized ?? getTodayReferenceInput(timeZone);
  const date = buildDateFromInput(inputValue, timeZone, mode);
  return { date, inputValue };
}

function extractParamValue(searchParams: SearchParams, key: string): string | null {
  if (!searchParams) return null;
  if (searchParams instanceof URLSearchParams) {
    const value = searchParams.get(key);
    return typeof value === "string" ? value : null;
  }
  const raw = searchParams[key];
  if (Array.isArray(raw)) {
    return typeof raw[0] === "string" ? raw[0] : null;
  }
  return typeof raw === "string" ? raw : null;
}

export function resolveReferenceDateFromSearchParams(
  searchParams?: SearchParams,
  options?: { timeZone?: string; paramName?: string; mode?: "start" | "end" },
) {
  const paramName = options?.paramName ?? DEFAULT_REFERENCE_DATE_PARAM;
  const rawValue = extractParamValue(searchParams, paramName);
  return resolveReferenceDate({
    value: rawValue,
    timeZone: options?.timeZone,
    mode: options?.mode,
  });
}

export function toTimeZoneDateFromInput(
  value: string,
  timeZone = DEFAULT_REFERENCE_TIME_ZONE,
  mode: "start" | "end" = "end",
): Date {
  if (!isValidDateInput(value)) {
    return resolveReferenceDate({ timeZone, mode }).date;
  }
  return buildDateFromInput(value, timeZone, mode);
}

export function formatReferenceDateLabel(
  date: Date,
  {
    timeZone = DEFAULT_REFERENCE_TIME_ZONE,
    locale = "pt-BR",
    fallback = "-",
  }: { timeZone?: string; locale?: string; fallback?: string } = {},
): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return fallback;
  }
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
