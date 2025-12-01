export type ChecklistWeightInput = Array<{ id?: string | null; itemId?: string | null; weight?: number | null; peso?: number | null }>;

export type ProgressEvent = {
  timestamp: number;
  percent?: number | null;
  items?: Array<{ id: string; pct: number }>;
};

function normaliseId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  return value || null;
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function buildChecklistWeightMap(input: ChecklistWeightInput) {
  const weights = new Map<string, number>();
  let totalWeight = 0;

  input.forEach((entry) => {
    const id = normaliseId(entry.id ?? entry.itemId);
    if (!id) return;
    const rawWeight = entry.weight ?? entry.peso;
    const weight = typeof rawWeight === "number" && Number.isFinite(rawWeight) ? clampPercent(rawWeight) : 0;
    weights.set(id, weight);
    totalWeight += weight;
  });

  return { weights, totalWeight };
}

function computeFromItems(
  latestPerItem: Map<string, number>,
  weights: Map<string, number>,
  totalWeight: number,
): number {
  if (weights.size === 0 || totalWeight <= 0) {
    if (!latestPerItem.size) return 0;
    let sum = 0;
    latestPerItem.forEach((value) => {
      sum += value;
    });
    return clampPercent(sum / latestPerItem.size);
  }

  let weighted = 0;
  weights.forEach((weight, id) => {
    const pct = latestPerItem.get(id) ?? 0;
    weighted += (weight * pct) / totalWeight;
  });
  return clampPercent(weighted);
}

export function computeProgressFromEvents(
  events: ProgressEvent[],
  options?: { weights?: Map<string, number>; totalWeight?: number },
) {
  const weights = options?.weights ?? new Map<string, number>();
  const totalWeight = options?.totalWeight ?? 0;
  const sorted = events
    .filter((event) => Number.isFinite(event.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);

  const latestPerItem = new Map<string, number>();
  const byDay = new Map<string, number>();
  let currentPercent = 0;
  let lastTimestamp: number | null = null;

  sorted.forEach((event) => {
    lastTimestamp = event.timestamp;

    if (Array.isArray(event.items) && event.items.length > 0) {
      event.items.forEach((item) => {
        const id = normaliseId(item.id);
        if (!id) return;
        const pct = clampPercent(typeof item.pct === "number" ? item.pct : Number(item.pct));
        latestPerItem.set(id, pct);
      });
      if (latestPerItem.size > 0) {
        currentPercent = computeFromItems(latestPerItem, weights, totalWeight);
      }
    }

    if (typeof event.percent === "number" && Number.isFinite(event.percent)) {
      currentPercent = clampPercent(event.percent);
    }

    const date = new Date(event.timestamp);
    const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const iso = day.toISOString().slice(0, 10);
    byDay.set(iso, Math.round(currentPercent * 100) / 100);
  });

  return { currentPercent: Math.round(currentPercent * 100) / 100, lastTimestamp, byDay };
}
