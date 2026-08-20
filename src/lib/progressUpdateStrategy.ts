export type ProgressUpdateStrategy = "fast-path" | "rebuild";

/**
 * Explicitly dated entries at or before the processed watermark may change the
 * historical ordering. Entries without an explicit report date are new,
 * transaction-ordered submissions and can use the constant-read fast path.
 */
export function chooseProgressUpdateStrategy(
  reportDateMillis: number | null | undefined,
  lastProgressUpdateMillis: number | null | undefined,
): ProgressUpdateStrategy {
  if (reportDateMillis == null) return "fast-path";
  if (lastProgressUpdateMillis == null) return "rebuild";
  return reportDateMillis > lastProgressUpdateMillis ? "fast-path" : "rebuild";
}
