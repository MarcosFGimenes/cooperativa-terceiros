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

  it("prioriza o percentual canônico e ignora campos legados obsoletos", () => {
    expect(
      resolveCurrentProgress({
        realPercent: 100,
        manualPercent: 100,
        andamento: 95,
        progress: 100,
      }),
    ).toBe(95);
  });

  it("usa o percentual de reabertura quando o serviço pendente ainda possui campos em 100%", () => {
    expect(
      resolveCurrentProgress({
        status: "Concluído",
        displayStatus: "Pendente",
        previousProgress: 95,
        realPercent: 100,
        progress: 100,
      }),
    ).toBe(95);
  });
});
