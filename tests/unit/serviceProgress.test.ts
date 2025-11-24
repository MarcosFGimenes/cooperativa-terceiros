import { describe, expect, it } from "vitest";

import {
  calcularPercentualSubpacote,
  calcularPercentualRealizadoSubpacote,
  calcularPercentualPlanejadoPacote,
  calcularPercentualRealizadoPacote,
  calcularPercentualPlanejadoServico,
  calcularCurvaSPlanejada,
  calcularCurvaSRealizada,
  calcularIndicadoresCurvaS,
  clampProgress,
  mapearServicosPlanejados,
  obterIntervaloSubpacote,
  resolveReopenedProgress,
  resolveServicoPercentualPlanejado,
  resolveServicoRealPercent,
  snapshotBeforeConclusion,
} from "@/lib/serviceProgress";
import { resolveReferenceDate } from "@/lib/referenceDate";

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

  describe("resolveServicoRealPercent", () => {
    it("prefers the last percentual update when available", () => {
      const percent = resolveServicoRealPercent({
        updates: [
          { percentual: 20, data: "2024-01-01" },
          { percentualReal: 65, dataAtualizacaoPercentual: "2024-01-05" },
        ],
        progress: 5,
      });

      expect(percent).toBe(65);
    });

    it("reads direct percentual fields when there is no history", () => {
      const percent = resolveServicoRealPercent({ percentualInformado: "37.2" });
      expect(percent).toBe(37);
    });

    it("clamps invalid or out of range values", () => {
      expect(resolveServicoRealPercent({ progress: 150 })).toBe(100);
      expect(resolveServicoRealPercent({ progress: -20 })).toBe(0);
    });
  });

  describe("resolveServicoPercentualPlanejado", () => {
    it("falls back to the planned subpackage when the service lacks dates", () => {
      const reference = new Date("2024-01-04T00:00:00Z");
      const percent = resolveServicoPercentualPlanejado(
        {
          subpacotePlanejado: {
            servicos: [
              {
                horasPrevistas: 10,
                dataInicio: new Date("2024-01-01T00:00:00Z"),
                dataFim: new Date("2024-01-06T00:00:00Z"),
              },
            ],
          },
        },
        reference,
      );

      expect(percent).toBeGreaterThan(0);
      expect(percent).toBeLessThan(100);
    });

    it("uses the matching subpackage inside a planned package", () => {
      const reference = new Date("2024-02-02T00:00:00Z");
      const percent = resolveServicoPercentualPlanejado(
        {
          pacotePlanejado: {
            subpacotes: [
              {
                id: "folder-b",
                servicos: [
                  {
                    horasPrevistas: 10,
                    dataInicio: new Date("2024-01-01T00:00:00Z"),
                    dataFim: new Date("2024-01-11T00:00:00Z"),
                  },
                ],
              },
              {
                id: "folder-a",
                servicos: [
                  {
                    horasPrevistas: 5,
                    dataInicio: new Date("2024-02-01T00:00:00Z"),
                    dataFim: new Date("2024-02-06T00:00:00Z"),
                  },
                ],
              },
            ],
          },
          subpacoteId: "folder-a",
        },
        reference,
      );

      expect(percent).toBeGreaterThan(0);
      expect(percent).toBeLessThanOrEqual(100);
    });
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

  describe("calcularPercentualPlanejadoPacote e calcularPercentualRealizadoPacote", () => {
    const reference = new Date("2024-11-24T00:00:00Z");

    it("applies hour-based weights across subpackages for planned progress", () => {
      const percentual = calcularPercentualPlanejadoPacote(
        {
          subpacotes: [
            {
              servicos: [
                { horasPrevistas: 10, dataInicio: "2024-11-20", dataFim: "2024-11-30" },
              ],
            },
            {
              servicos: [
                { horasPrevistas: 30, dataInicio: "2024-11-20", dataFim: "2024-12-20" },
              ],
            },
          ],
        },
        reference,
      );

      expect(percentual).toBeCloseTo((50 * 10 + 20 * 30) / 40, 5);
    });

    it("applies hour-based weights across subpackages for realized progress", () => {
      const percentual = calcularPercentualRealizadoPacote(
        {
          subpacotes: [
            {
              servicos: [
                {
                  horasPrevistas: 10,
                  dataInicio: "2024-11-20",
                  dataFim: "2024-11-30",
                  atualizacoes: [
                    { data: "2024-11-22", percentual: 25 },
                    { data: "2024-11-24", percentual: 50 },
                  ],
                },
              ],
            },
            {
              servicos: [
                {
                  horasPrevistas: 30,
                  dataInicio: "2024-11-20",
                  dataFim: "2024-12-20",
                  atualizacoes: [
                    { data: "2024-11-23", percentual: 10 },
                    { data: "2024-11-24", percentual: 20 },
                  ],
                },
              ],
            },
          ],
        },
        reference,
      );

      expect(percentual).toBeCloseTo((50 * 10 + 20 * 30) / 40, 5);
    });
  });

  describe("calcularPercentualRealizadoSubpacote", () => {
    const reference = new Date("2024-01-05T00:00:00Z");

    it("returns zero when no services contribute hours", () => {
      expect(calcularPercentualRealizadoSubpacote({ servicos: [] }, reference)).toBe(0);
      expect(
        calcularPercentualRealizadoSubpacote(
          {
            servicos: [
              { horasPrevistas: 0, dataInicio: "2024-01-01", dataFim: "2024-01-10" },
              { horasPrevistas: null },
            ],
          },
          reference,
        ),
      ).toBe(0);
    });

    it("calculates weighted real progress based on the latest updates", () => {
      const percentual = calcularPercentualRealizadoSubpacote(
        {
          servicos: [
            {
              horasPrevistas: 10,
              dataInicio: "2024-01-01",
              dataFim: "2024-01-06",
              atualizacoes: [
                { data: "2024-01-02", percentual: 20 },
                { data: "2024-01-05", percentual: 40 },
                { data: "2024-01-07", percentual: 80 },
              ],
            },
            {
              horasPrevistas: 5,
              dataInicio: "2024-01-01",
              dataFim: "2024-01-10",
              atualizacoes: [
                { data: "2024-01-03", percentual: 10 },
                { data: "2024-01-04", percentual: 50 },
              ],
            },
          ],
        },
        reference,
      );
      expect(percentual).toBeCloseTo((40 * 10 + 50 * 5) / 15, 5);
    });

    it("treats missing updates as zero progress", () => {
      const percentual = calcularPercentualRealizadoSubpacote(
        {
          servicos: [
            { horasPrevistas: 8, dataInicio: "2024-01-01", dataFim: "2024-01-05" },
            {
              horasPrevistas: 4,
              dataInicio: "2024-01-02",
              dataFim: "2024-01-06",
              atualizacoes: [{ data: "2024-01-04", percentual: 75 }],
            },
          ],
        },
        reference,
      );
      expect(percentual).toBeCloseTo((0 * 8 + 75 * 4) / 12, 5);
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

    it("prefers plannedDaily series when available", () => {
      const percentual = calcularPercentualPlanejadoServico(
        {
          dataInicio: new Date("2024-01-01T00:00:00Z"),
          dataFim: new Date("2024-01-03T00:00:00Z"),
          plannedDaily: [0, 35, 80],
        },
        new Date("2024-01-02T12:00:00Z"),
      );
      expect(percentual).toBe(35);
    });

    it("returns 100 after the plannedDaily schedule ends", () => {
      const percentual = calcularPercentualPlanejadoServico(
        {
          dataInicio: new Date("2024-01-01T00:00:00Z"),
          dataFim: new Date("2024-01-03T00:00:00Z"),
          plannedDaily: [0, 50, 60],
        },
        new Date("2024-01-05T00:00:00Z"),
      );
      expect(percentual).toBe(100);
    });

    it("falls back to the linear calculation when plannedDaily length mismatches", () => {
      const percentual = calcularPercentualPlanejadoServico(
        {
          dataInicio: new Date("2024-01-01T00:00:00Z"),
          dataFim: new Date("2024-01-04T00:00:00Z"),
          plannedDaily: [0, 50],
        },
        new Date("2024-01-03T00:00:00Z"),
      );
      expect(percentual).toBeGreaterThan(0);
      expect(percentual).toBeLessThan(100);
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

    it("handles mid-interval references using the selected date", () => {
      const { date: referenceDate } = resolveReferenceDate("2025-11-24");
      const percentual = calcularPercentualPlanejadoServico(
        {
          dataInicio: new Date("2025-11-20T00:00:00Z"),
          dataFim: new Date("2025-11-29T00:00:00Z"),
        },
        referenceDate,
      );

      expect(percentual).toBeCloseTo(50, 5);
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

  describe("Curva S consolidada", () => {
    const servicoA = {
      id: "A",
      horasPrevistas: 10,
      dataInicio: new Date("2024-01-01T00:00:00Z"),
      dataFim: new Date("2024-01-05T00:00:00Z"),
      atualizacoes: [
        { data: new Date("2024-01-02T00:00:00Z"), percentual: 20 },
        { data: new Date("2024-01-04T00:00:00Z"), percentual: 60 },
      ],
    };
    const servicoB = {
      id: "B",
      horasPrevistas: 5,
      dataInicio: new Date("2024-01-03T00:00:00Z"),
      dataFim: new Date("2024-01-07T00:00:00Z"),
      atualizacoes: [{ data: new Date("2024-01-05T00:00:00Z"), percentual: 40 }],
    };
    const pacoteCurva = {
      subpacotes: [{ servicos: [servicoA] }, { services: [servicoB] }],
      servicos: [
        {
          horasPrevistas: 100,
          dataInicio: new Date("2023-12-01T00:00:00Z"),
          dataFim: new Date("2024-02-01T00:00:00Z"),
          atualizacoes: [{ data: new Date("2023-12-15T00:00:00Z"), percentual: 100 }],
        },
      ],
    };

    const obterPercentual = (curva: { data: Date; percentual: number }[], iso: string) => {
      const alvo = new Date(iso).getTime();
      const ponto = curva.find((item) => item.data.getTime() === alvo);
      if (!ponto) {
        throw new Error(`Ponto não encontrado para ${iso}`);
      }
      return ponto.percentual;
    };

    it("monta a curva planejada apenas com os serviços de subpacotes", () => {
      const curvaPlanejada = calcularCurvaSPlanejada(pacoteCurva);
      expect(curvaPlanejada).toHaveLength(7);
      expect(curvaPlanejada[0].data.toISOString()).toBe("2024-01-01T00:00:00.000Z");
      expect(curvaPlanejada[curvaPlanejada.length - 1].data.toISOString()).toBe(
        "2024-01-07T00:00:00.000Z",
      );
      expect(obterPercentual(curvaPlanejada, "2024-01-03T00:00:00Z")).toBeCloseTo(33.33, 1);
    });

    it("usa o histórico do Terceiro para calcular a curva realizada", () => {
      const curvaRealizada = calcularCurvaSRealizada(pacoteCurva);
      expect(obterPercentual(curvaRealizada, "2024-01-01T00:00:00Z")).toBe(0);
      expect(obterPercentual(curvaRealizada, "2024-01-04T00:00:00Z")).toBeCloseTo(40, 1);
    });

    it("calcula os indicadores consolidados com base nas curvas", () => {
      const indicadores = calcularIndicadoresCurvaS(
        pacoteCurva,
        new Date("2024-01-05T00:00:00Z"),
      );
      expect(indicadores.planejadoTotal).toBe(100);
      expect(indicadores.planejadoAteHoje).toBeCloseTo(83.33, 1);
      expect(indicadores.realizado).toBeCloseTo(53.33, 1);
      expect(indicadores.diferenca).toBeCloseTo(-29.99, 1);
    });
  });

  describe("obterIntervaloSubpacote", () => {
    it("returns the earliest start and latest finish across services", () => {
      const intervalo = obterIntervaloSubpacote({
        servicos: [
          { horasPrevistas: 5, dataInicio: "2024-02-10", dataFim: "2024-02-20" },
          { horasPrevistas: 5, dataInicio: "2024-02-01", dataFim: "2024-03-01" },
        ],
      });
      expect(intervalo.inicio?.toISOString()).toBe(new Date("2024-02-01T00:00:00.000Z").toISOString());
      expect(intervalo.fim?.toISOString()).toBe(new Date("2024-03-01T00:00:00.000Z").toISOString());
    });

    it("falls back to null values when there are no valid ranges", () => {
      const intervalo = obterIntervaloSubpacote({ servicos: [{ horasPrevistas: 5 }] });
      expect(intervalo.inicio).toBeNull();
      expect(intervalo.fim).toBeNull();
    });
  });
});
