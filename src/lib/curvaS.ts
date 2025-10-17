import { getAdmin } from "@/lib/firebaseAdmin";

type CurvePoint = { d: string; pct: number };

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

const addDays = (date: Date, amount: number) => {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + amount);
  return result;
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

  void horasTotais; // mantido para compatibilidade com futuras ponderações por esforço

  const [first, last] = (() => {
    const a = start ?? anchor;
    const b = end ?? anchor;
    return a.getTime() <= b.getTime() ? [a, b] : [b, a];
  })();

  const totalDays = Math.max(
    1,
    Math.floor((last.getTime() - first.getTime()) / (24 * 60 * 60 * 1000)) + 1,
  );

  if (totalDays === 1) {
    return [{ d: toISODate(first), pct: 100 }];
  }

  const step = 100 / (totalDays - 1);
  const points: CurvePoint[] = [];
  for (let i = 0; i < totalDays; i += 1) {
    const current = addDays(first, i);
    const pct = i === totalDays - 1 ? 100 : roundTwo(clampPercent(i * step));
    points.push({ d: toISODate(current), pct });
  }
  if (points.length) {
    points[points.length - 1] = { ...points[points.length - 1], pct: 100 };
  }
  return points;
}

export async function curvaRealizada(serviceId: string): Promise<CurvePoint[]> {
  const { db } = getAdmin();
  const serviceRef = db.collection("services").doc(serviceId);
  const [serviceSnap, updatesSnap] = await Promise.all([
    serviceRef.get(),
    serviceRef.collection("serviceUpdates").orderBy("date", "asc").get(),
  ]);

  if (!serviceSnap.exists) return [];
  const serviceData = serviceSnap.data() ?? {};

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

  updatesSnap.forEach((docSnap) => {
    const update = (docSnap.data() ?? {}) as ServiceUpdateLike;
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
