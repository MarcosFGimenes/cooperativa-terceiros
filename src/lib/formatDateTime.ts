type DateInput = number | string | Date | null | undefined;

type PartsOptions = {
  timeZone?: string;
  includeTime?: boolean;
};

type FormatOptions = {
  timeZone?: string;
  fallback?: string;
};

type PartsResult = {
  year: string;
  month: string;
  day: string;
  hour?: string;
  minute?: string;
};

const MONTH_NAMES_LONG = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const MONTH_NAMES_SHORT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "string" && value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function toParts(value: DateInput, options?: PartsOptions): PartsResult | null {
  const date = toDate(value);
  if (!date) return null;

  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: options?.timeZone ?? "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      ...(options?.includeTime
        ? { hour: "2-digit", minute: "2-digit", hour12: false }
        : {}),
    });

    const parts = formatter.formatToParts(date);
    const map: Record<string, string> = {};
    for (const part of parts) {
      map[part.type] = part.value;
    }

    const year = map.year;
    const month = map.month;
    const day = map.day;
    if (!year || !month || !day) return null;

    const hour = map.hour;
    const minute = map.minute;

    return { year, month, day, hour, minute };
  } catch {
    return null;
  }
}

export function formatDate(value: DateInput, options?: FormatOptions): string {
  const parts = toParts(value, { timeZone: options?.timeZone });
  if (!parts) return options?.fallback ?? "";
  return `${parts.day}/${parts.month}/${parts.year}`;
}

export function formatDateTime(value: DateInput, options?: FormatOptions): string {
  const parts = toParts(value, { timeZone: options?.timeZone, includeTime: true });
  if (!parts) return options?.fallback ?? "";
  const hour = parts.hour ?? "00";
  const minute = parts.minute ?? "00";
  return `${parts.day}/${parts.month}/${parts.year} ${hour}:${minute}`;
}

export function formatLongDate(value: DateInput, options?: FormatOptions): string {
  const parts = toParts(value, { timeZone: options?.timeZone });
  if (!parts) return options?.fallback ?? "";
  const monthIndex = Number(parts.month) - 1;
  const monthName = MONTH_NAMES_LONG[monthIndex] ?? parts.month;
  return `${parts.day} de ${monthName} de ${parts.year}`;
}

export function formatShortMonthDate(value: DateInput, options?: FormatOptions): string {
  const parts = toParts(value, { timeZone: options?.timeZone });
  if (!parts) return options?.fallback ?? "";
  const monthIndex = Number(parts.month) - 1;
  const monthName = MONTH_NAMES_SHORT[monthIndex] ?? parts.month;
  return `${parts.day} ${monthName}`;
}

export function formatDayKey(value: DateInput, options?: FormatOptions): string {
  const parts = toParts(value, { timeZone: options?.timeZone });
  if (!parts) return options?.fallback ?? "";
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function formatDayMonth(value: DateInput, options?: FormatOptions): string {
  const parts = toParts(value, { timeZone: options?.timeZone });
  if (!parts) return options?.fallback ?? "";
  return `${parts.day}/${parts.month}`;
}

