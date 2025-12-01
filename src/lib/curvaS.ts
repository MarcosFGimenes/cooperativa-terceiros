import { computeProgressHistory } from "@/lib/progressHistoryServer";

import type { IsoDate } from "./curvaSShared";
import { computePlannedUniformPercent, dateRangeInclusive } from "./curvaSShared";

export type { IsoDate } from "./curvaSShared";
export { computePlannedUniformPercent, dateRangeInclusive, mapSeriesToDates, toCsv } from "./curvaSShared";

type CurvePoint = { d: IsoDate; pct: number };

const clampPercent = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
};

const normaliseDate = (value: Date | null | undefined): Date | null => {
  if (!value) return null;
  if (!(value instanceof Date)) return null;
  const time = value.getTime();
  if (!Number.isFinite(time)) return null;
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
};

export function curvaPlanejada(inicio: Date, fim: Date, horasTotais: number): CurvePoint[] {
  const start = normaliseDate(inicio);
  const end = normaliseDate(fim);
  const anchor = start ?? end;
  if (!anchor) return [];

  const [first, last] = (() => {
    const a = start ?? anchor;
    const b = end ?? anchor;
    return a.getTime() <= b.getTime() ? [a, b] : [b, a];
  })();

  const dates = dateRangeInclusive(first, last);
  if (!dates.length) return [];

  const plannedSeries = computePlannedUniformPercent(first, last, horasTotais);
  const hasSeries = plannedSeries.length === dates.length;

  let lastPct = 0;
  const points = dates.map((date, index) => {
    let pct: number;
    if (hasSeries) {
      const value = plannedSeries[index] ?? lastPct;
      pct = Math.round(clampPercent(value));
    } else {
      pct = index === dates.length - 1 ? 100 : lastPct;
    }
    if (pct < lastPct) pct = lastPct;
    if (index === dates.length - 1) pct = 100;
    lastPct = pct;
    return { d: date, pct };
  });

  return points;
}

export async function curvaRealizada(serviceId: string): Promise<CurvePoint[]> {
  const history = await computeProgressHistory(serviceId);
  if (!history) return [];

  return Array.from(history.byDay.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([d, pct]) => ({ d: d as IsoDate, pct: Math.round(pct) }));
}
