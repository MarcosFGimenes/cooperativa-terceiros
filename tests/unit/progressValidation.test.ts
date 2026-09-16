import { describe, expect, it } from "vitest";

import {
  assertNonDecreasingProgress,
  ProgressDecreaseError,
  resolveCurrentProgress,
} from "@/lib/progressValidation";

describe("progress validation", () => {
  it("permite repetir o percentual atual ou informar um percentual maior", () => {
    expect(() => assertNonDecreasingProgress(45, 45)).not.toThrow();
    expect(() => assertNonDecreasingProgress(60, 45)).not.toThrow();
  });

  it("impede um percentual menor que o progresso atual", () => {
    expect(() => assertNonDecreasingProgress(44, 45)).toThrowError(ProgressDecreaseError);
    expect(() => assertNonDecreasingProgress(44, 45)).toThrow(
      "O percentual não pode ser menor que o progresso atual de 45%.",
    );
  });

  it("usa o maior percentual persistido como limite mínimo", () => {
    expect(
      resolveCurrentProgress({
        realPercent: 35,
        manualPercent: "42,5",
        andamento: 40,
        progress: 41,
      }),
    ).toBe(42.5);
  });
});
