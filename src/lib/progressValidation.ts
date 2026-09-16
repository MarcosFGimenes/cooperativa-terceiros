const PROGRESS_FIELDS = [
  "realPercent",
  "manualPercent",
  "andamento",
  "progress",
  "percent",
  "percentualRealAtual",
  "realPercentSnapshot",
] as const;

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export class ProgressDecreaseError extends Error {
  constructor(public readonly currentPercent: number) {
    super(`O percentual não pode ser menor que o progresso atual de ${currentPercent}%.`);
    this.name = "ProgressDecreaseError";
  }
}

export function resolveCurrentProgress(data: Record<string, unknown>): number {
  const candidates = PROGRESS_FIELDS.map((field) => toFiniteNumber(data[field])).filter(
    (value): value is number => value !== null,
  );
  return candidates.length > 0 ? clampPercent(Math.max(...candidates)) : 0;
}

export function assertNonDecreasingProgress(nextPercent: number, currentPercent: number): void {
  if (clampPercent(nextPercent) < clampPercent(currentPercent)) {
    throw new ProgressDecreaseError(clampPercent(currentPercent));
  }
}
