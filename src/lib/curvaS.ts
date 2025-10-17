import type { IsoDate } from "./curvaSShared";
import {
  computePlannedUniformPercent,
  dateRangeInclusive,
  mapSeriesToDates,
  toCsv,
} from "./curvaSShared";

export { IsoDate, computePlannedUniformPercent, dateRangeInclusive, mapSeriesToDates, toCsv } from "./curvaSShared";

type CurvePoint = { d: IsoDate; pct: number };

type ChecklistItemLike = {
  id?: string;
  itemId?: string;
  weight?: number;
  peso?: number;
};

type UpdateItemLike = { itemId?: string; id?: string; pct?: number };

type ServiceUpdateLike = {
  date?: unknown;
  createdAt?: unknown;
  items?: UpdateItemLike[];
  totalPct?: unknown;
};

const clampPercent = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
};

const roundTwo = (value: number) => Math.round(value * 100) / 100;

const toISODate = (date: Date) => date.toISOString().slice(0, 10);

const normaliseDate = (value: Date | null | undefined): Date | null => {
  if (!value) return null;
  if (!(value instanceof Date)) return null;
  const time = value.getTime();
  if (!Number.isFinite(time)) return null;
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
};

const toDate = (input: unknown): Date | null => {
  if (!input) return null;
  if (input instanceof Date) return input;
  if (typeof input === "number") {
    const date = new Date(input);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const possibleTimestamp = input as { toDate?: () => Date; toMillis?: () => number };
  if (typeof possibleTimestamp?.toDate === "function") {
    const date = possibleTimestamp.toDate();
    return Number.isNaN(date?.getTime()) ? null : date;
  }
  if (typeof possibleTimestamp?.toMillis === "function") {
    const millis = possibleTimestamp.toMillis();
    if (typeof millis === "number") {
      const date = new Date(millis);
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }
  return null;
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

function buildCurve(serviceData: Record<string, unknown>, updates: ServiceUpdateLike[]): CurvePoint[] {
  const checklistRaw = Array.isArray(serviceData.checklist) ? serviceData.checklist : [];
  const hasChecklist = checklistRaw.length > 0;

  const weights = new Map<string, number>();
  let totalWeight = 0;
  if (hasChecklist) {
    checklistRaw.forEach((item: ChecklistItemLike) => {
      const itemId = String(item.id ?? item.itemId ?? "").trim();
      if (!itemId) return;
      const weightValue =
        typeof item.weight === "number"
          ? item.weight
          : typeof item.peso === "number"
            ? item.peso
            : 0;
      const weight = clampPercent(weightValue);
      weights.set(itemId, weight);
      totalWeight += weight;
    });
  }

  const latestPerItem = new Map<string, number>();
  const byDay = new Map<string, number>();

  updates.forEach((update) => {
    const date = toDate(update.date ?? update.createdAt);
    if (!date) return;
    const dateKey = toISODate(normaliseDate(date) ?? date);

    if (hasChecklist) {
      const items = Array.isArray(update.items) ? update.items : [];
      let touched = false;
      items.forEach((item) => {
        const itemId = String(item.itemId ?? item.id ?? "").trim();
        if (!itemId) return;
        if (typeof item.pct !== "number") return;
        const pct = clampPercent(item.pct);
        latestPerItem.set(itemId, pct);
        touched = true;
      });

      if (!touched && !latestPerItem.size) return;

      const denominator = totalWeight > 0 ? totalWeight : weights.size || 1;
      let sum = 0;
      if (denominator === totalWeight && totalWeight > 0) {
        weights.forEach((weight, itemId) => {
          const pct = latestPerItem.get(itemId) ?? 0;
          sum += (weight * pct) / totalWeight;
        });
      } else {
        latestPerItem.forEach((pct) => {
          sum += pct;
        });
        sum /= latestPerItem.size || 1;
      }

      byDay.set(dateKey, roundTwo(clampPercent(sum)));
      return;
    }

    if (typeof update.totalPct !== "number") return;
    byDay.set(dateKey, roundTwo(clampPercent(update.totalPct)));
  });

  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([d, pct]) => ({ d, pct }));
}

export async function curvaRealizada(serviceId: string): Promise<CurvePoint[]> {
  const { tryGetAdminDb, getServerWebDb } = await import("@/lib/serverDb");
  const adminDb = tryGetAdminDb();
  if (adminDb) {
    const serviceRef = adminDb.collection("services").doc(serviceId);
    const [serviceSnap, updatesSnap] = await Promise.all([
      serviceRef.get(),
      serviceRef.collection("serviceUpdates").orderBy("date", "asc").get(),
    ]);

    if (!serviceSnap.exists) return [];
    const serviceData = serviceSnap.data() ?? {};
    const updates = updatesSnap.docs.map((docSnap) => docSnap.data() ?? {}) as ServiceUpdateLike[];
    return buildCurve(serviceData, updates);
  }

  const db = await getServerWebDb();
  const { doc, getDoc, collection, query, orderBy, getDocs } = await import("firebase/firestore");

  const serviceRef = doc(db, "services", serviceId);
  const serviceSnap = await getDoc(serviceRef);
  if (!serviceSnap.exists()) return [];

  const updatesSnap = await getDocs(query(collection(serviceRef, "serviceUpdates"), orderBy("date", "asc")));
  const updates = updatesSnap.docs.map((docSnap) => docSnap.data() ?? {}) as ServiceUpdateLike[];
  return buildCurve(serviceSnap.data() ?? {}, updates);
}
