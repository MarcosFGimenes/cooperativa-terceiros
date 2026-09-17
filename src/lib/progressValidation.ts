const PROGRESS_FIELDS = [
  "andamento",
  "percentualRealAtual",
  "realPercentSnapshot",
  "manualPercent",
  "realPercent",
  "progress",
  "percent",
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
  // Os documentos legados podem conter campos antigos ainda em 100% depois de
  // uma correção para 95%. Use a mesma precedência das telas em vez do maior
  // número, que transformava esse resíduo em um bloqueio permanente de RDOs.
  for (const field of PROGRESS_FIELDS) {
    const value = toFiniteNumber(data[field]);
    if (value !== null) return clampPercent(value);
  }
  return 0;
}

export function assertNonDecreasingProgress(nextPercent: number, currentPercent: number): void {
  if (clampPercent(nextPercent) < clampPercent(currentPercent)) {
    throw new ProgressDecreaseError(clampPercent(currentPercent));
  }
}
