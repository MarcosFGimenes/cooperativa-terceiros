import { describe, expect, it } from "vitest";

import {
  calcularPercentualSubpacote,
  calcularPercentualPlanejadoServico,
  clampProgress,
  mapearServicosPlanejados,
  resolveReopenedProgress,
  snapshotBeforeConclusion,
} from "@/lib/serviceProgress";

describe("serviceProgress utilities", () => {
  it("clamps progress to 0-100 range", () => {
    expect(clampProgress(-10)).toBe(0);
    expect(clampProgress(42.6)).toBe(43);
    expect(clampProgress(180)).toBe(100);
  });

  it("selects snapshot before conclusion preferring values below 100", () => {
    expect(snapshotBeforeConclusion(67, null)).toBe(67);
    expect(snapshotBeforeConclusion(100, 80)).toBe(80);
    expect(snapshotBeforeConclusion(100, 150)).toBe(0);
  });

  it("resolves reopened progress using stored values and history", () => {
    const target = resolveReopenedProgress({
      requested: null,
      previousStored: 72,
      history: [null, 55, 100],
      current: 100,
    });
    expect(target).toBe(72);
  });

  it("falls back to history when stored value is missing", () => {
    const target = resolveReopenedProgress({
      requested: null,
      previousStored: null,
      history: [null, 48, 100],
      current: 100,
    });
    expect(target).toBe(48);
  });

  it("returns zero when no candidate is available", () => {
    const target = resolveReopenedProgress({
      requested: null,
      previousStored: null,
      history: [null],
      current: 100,
    });
    expect(target).toBe(0);
  });

  describe("calcularPercentualSubpacote", () => {
    const reference = new Date("2024-01-06T00:00:00Z");

    it("returns zero when there are no valid services", () => {
      expect(calcularPercentualSubpacote({ servicos: [] }, reference)).toBe(0);
      expect(
        calcularPercentualSubpacote(
          {
            servicos: [
              { horasPrevistas: 0, dataInicio: "2024-01-01", dataFim: "2024-01-10" },
              { horasPrevistas: 10, dataInicio: "2024-01-10", dataFim: "2024-01-01" },
              { horasPrevistas: 5 },
            ],
          },
          reference,
        ),
      ).toBe(0);
    });

    it("calculates weighted average progress using hours", () => {
      const percentual = calcularPercentualSubpacote(
        {
          servicos: [
            {
              horasPrevistas: 10,
              dataInicio: new Date("2024-01-01T00:00:00Z"),
              dataFim: new Date("2024-01-11T00:00:00Z"),
            },
            {
              horasPrevistas: 5,
              dataInicio: new Date("2024-01-01T00:00:00Z"),
              dataFim: new Date("2024-01-06T00:00:00Z"),
            },
          ],
        },
        reference,
      );
      expect(percentual).toBeCloseTo((50 * 10 + 100 * 5) / 15, 5);
    });

    it("clamps the final percentage between 0 and 100", () => {
      const percentual = calcularPercentualSubpacote(
        {
          servicos: [
            {
              horasPrevistas: 8,
              dataInicio: new Date("2024-01-01T00:00:00Z"),
              dataFim: new Date("2024-01-04T00:00:00Z"),
            },
            {
              horasPrevistas: 4,
              dataInicio: new Date("2024-01-02T00:00:00Z"),
              dataFim: new Date("2024-01-05T00:00:00Z"),
            },
          ],
        },
        new Date("2024-01-20T00:00:00Z"),
      );
      expect(percentual).toBe(100);
    });
  });

  describe("calcularPercentualPlanejadoServico", () => {
    const reference = new Date("2024-01-10T00:00:00Z");

    it("returns zero when reference is before start", () => {
      const percentual = calcularPercentualPlanejadoServico(
        {
          dataInicio: new Date("2024-01-15T00:00:00Z"),
          dataFim: new Date("2024-01-25T00:00:00Z"),
        },
        reference,
      );
      expect(percentual).toBe(0);
    });

    it("returns one hundred when reference is after finish", () => {
      const percentual = calcularPercentualPlanejadoServico(
        {
          dataInicio: new Date("2024-01-01T00:00:00Z"),
          dataFim: new Date("2024-01-05T00:00:00Z"),
        },
        reference,
      );
      expect(percentual).toBe(100);
    });

    it("calculates proportional progress when inside the interval", () => {
      const percentual = calcularPercentualPlanejadoServico(
        {
          dataInicio: new Date("2024-01-01T00:00:00Z"),
          dataFim: new Date("2024-01-11T00:00:00Z"),
        },
        reference,
      );
      expect(percentual).toBeCloseTo(90, 5);
    });

    it("returns zero for invalid dates", () => {
      expect(
        calcularPercentualPlanejadoServico(
          {
            dataInicio: new Date("2024-01-05T00:00:00Z"),
            dataFim: new Date("2024-01-05T00:00:00Z"),
          },
          reference,
        ),
      ).toBe(0);
    });
  });

  describe("mapearServicosPlanejados", () => {
    it("maps planned and real percentages for each service", () => {
      const reference = new Date("2024-01-06T00:00:00Z");
      const result = mapearServicosPlanejados(
        [
          {
            id: "abc",
            descricao: "Serviço 1",
            dataInicio: new Date("2024-01-01T00:00:00Z"),
            dataFim: new Date("2024-01-11T00:00:00Z"),
            percentualRealAtual: 55,
          },
          {
            id: 2,
            description: "Serviço 2",
            dataInicio: new Date("2024-01-05T00:00:00Z"),
            dataFim: new Date("2024-01-15T00:00:00Z"),
            percentualRealAtual: "150",
          },
        ],
        reference,
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ id: "abc", descricao: "Serviço 1", percentualReal: 55 });
      expect(result[0].percentualPlanejado).toBeCloseTo(50, 5);
      expect(result[1]).toMatchObject({ id: "2", descricao: "Serviço 2", percentualReal: 100, percentualPlanejado: 0 });
    });

    it("returns zero when real percentage is missing", () => {
      const reference = new Date("2024-01-06T00:00:00Z");
      const result = mapearServicosPlanejados(
        [
          {
            id: "abc",
            descricao: "Serviço 1",
            dataInicio: new Date("2024-01-01T00:00:00Z"),
            dataFim: new Date("2024-01-11T00:00:00Z"),
            percentualRealAtual: null,
          },
        ],
        reference,
      );

      expect(result[0]).toMatchObject({ percentualReal: 0 });
    });
  });
});
