export function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function snapshotBeforeConclusion(current: number, previous?: number | null): number {
  const candidates = [current, previous].filter((value): value is number => Number.isFinite(value ?? NaN));
  for (const candidate of candidates) {
    const clamped = clampProgress(candidate);
    if (clamped < 100) {
      return clamped;
    }
  }
  return 0;
}

type ResolveReopenParams = {
  requested?: number | null;
  previousStored?: number | null;
  history?: Array<number | null | undefined>;
  current?: number | null;
};

export function resolveReopenedProgress({
  requested,
  previousStored,
  history = [],
  current,
}: ResolveReopenParams): number {
  const candidates: Array<number | null | undefined> = [requested, previousStored, ...history, current];

  for (const candidate of candidates) {
    if (!Number.isFinite(candidate ?? NaN)) continue;
    const clamped = clampProgress(Number(candidate));
    if (clamped < 100) {
      return clamped;
    }
  }

  return 0;
}
