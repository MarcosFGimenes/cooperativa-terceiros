import { adminDb } from "@/lib/firebaseAdmin";
import type { Service } from "@/lib/types";
import type { Timestamp } from "firebase-admin/firestore";

type PlannedPoint = { date: string; planned: number };
type RealizedPoint = { date: string; realized: number };

const clampPercent = (value: number) => {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
};

const roundTwoDecimals = (value: number) => Math.round(value * 100) / 100;

const toISODate = (date: Date) => date.toISOString().slice(0, 10);

const servicesCollection = () => adminDb.collection("services");

const parseISODate = (value: string): Date | null => {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const toDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  const possibleTs = value as Timestamp | { toDate?: () => Date; toMillis?: () => number };
  if (typeof possibleTs?.toDate === "function") return possibleTs.toDate();
  if (typeof possibleTs?.toMillis === "function") {
    const millis = possibleTs.toMillis();
    if (typeof millis === "number") return new Date(millis);
  }
  return null;
};

export const daysBetweenInclusive = (startISO: string, endISO: string): string[] => {
  const startDate = parseISODate(startISO);
  const endDate = parseISODate(endISO);
  if (!startDate || !endDate) return [];
  const [minDate, maxDate] =
    startDate.getTime() <= endDate.getTime() ? [startDate, endDate] : [endDate, startDate];

  const result: string[] = [];
  for (
    let cursor = new Date(minDate.getTime());
    cursor.getTime() <= maxDate.getTime();
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    result.push(toISODate(cursor));
  }
  return result;
};

export const plannedSeries = (service: Service): PlannedPoint[] => {
  const days = daysBetweenInclusive(service.plannedStart, service.plannedEnd);
  if (!days.length) return [];
  if (days.length === 1) {
    return [{ date: days[0], planned: 100 }];
  }

  const increment = 100 / (days.length - 1);
  const series = days.map((date, index) => ({
    date,
    planned: roundTwoDecimals(clampPercent(index * increment)),
  }));
  series[series.length - 1] = { ...series[series.length - 1], planned: 100 };
  return series;
};

export const realizedSeries = async (serviceId: string): Promise<RealizedPoint[]> => {
  const serviceRef = servicesCollection().doc(serviceId);
  const [serviceSnap, updatesSnap] = await Promise.all([
    serviceRef.get(),
    serviceRef.collection("updates").orderBy("createdAt", "asc").get(),
  ]);

  if (!serviceSnap.exists) return [];
  const hasChecklist = Boolean(serviceSnap.data()?.hasChecklist);

  let lastValue = 0;
  const byDay = new Map<string, number>();
  updatesSnap.forEach((doc) => {
    const data = doc.data() ?? {};
    const createdAt = toDate(data.createdAt);
    if (!createdAt) return;
    const dateKey = toISODate(createdAt);

    const rawValue = hasChecklist
      ? data.realPercentSnapshot
      : data.manualPercent ?? data.realPercentSnapshot;
    if (typeof rawValue !== "number") return;

    lastValue = Math.max(lastValue, clampPercent(rawValue));
    byDay.set(dateKey, lastValue);
  });

  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, realized: roundTwoDecimals(value) }));
};

export const mergeToSCurve = (
  planned: PlannedPoint[],
  realized: RealizedPoint[],
): { labels: string[]; planned: number[]; realized: number[] } => {
  const plannedMap = new Map(planned.map((item) => [item.date, clampPercent(item.planned)]));
  const realizedMap = new Map(realized.map((item) => [item.date, clampPercent(item.realized)]));

  const labels = Array.from(new Set([...plannedMap.keys(), ...realizedMap.keys()])).sort();

  let plannedAccumulator = 0;
  let realizedAccumulator = 0;
  const plannedValues: number[] = [];
  const realizedValues: number[] = [];

  labels.forEach((date) => {
    if (plannedMap.has(date)) {
      plannedAccumulator = Math.max(plannedAccumulator, plannedMap.get(date) ?? 0);
    }
    plannedValues.push(roundTwoDecimals(plannedAccumulator));

    if (realizedMap.has(date)) {
      realizedAccumulator = Math.max(realizedAccumulator, realizedMap.get(date) ?? 0);
    }
    realizedValues.push(roundTwoDecimals(realizedAccumulator));
  });

  return { labels, planned: plannedValues, realized: realizedValues };
};
