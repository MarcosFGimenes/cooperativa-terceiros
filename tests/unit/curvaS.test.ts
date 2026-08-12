import { beforeEach, describe, expect, it, vi } from "vitest";

const computeProgressHistoryMock = vi.fn();

vi.mock("@/lib/progressHistoryServer", () => ({
  computeProgressHistory: computeProgressHistoryMock,
}));

import { curvaRealizadaPacote } from "@/lib/curvaS";
import { computeProgressFromEvents } from "@/lib/progressHistory";

describe("curvaRealizadaPacote", () => {
  beforeEach(() => {
    computeProgressHistoryMock.mockReset();
  });

  it("preserva o percentual de um lançamento anterior ao início do gráfico no primeiro dia exibido", async () => {
    computeProgressHistoryMock.mockResolvedValue({
      byDay: new Map([
        ["2026-08-03", 30],
        ["2026-08-05", 60],
      ]),
      lastExplicitTimestamp: new Date("2026-08-05T00:00:00.000Z").getTime(),
    });

    const curve = await curvaRealizadaPacote(
      [{ id: "service-1", hours: 10 }],
      new Date("2026-08-05T00:00:00.000Z"),
      new Date("2026-08-10T00:00:00.000Z"),
    );

    expect(curve).toEqual([
      { d: "2026-08-05", pct: 30 },
      { d: "2026-08-06", pct: 60 },
      { d: "2026-08-07", pct: 60 },
      { d: "2026-08-08", pct: 60 },
      { d: "2026-08-09", pct: 60 },
      { d: "2026-08-10", pct: 60 },
    ]);
  });

  it("ignora data explícita posterior quando o percentual não mudou", () => {
    const result = computeProgressFromEvents([
      { timestamp: new Date("2026-08-11T12:00:00.000Z").getTime(), percent: 60, explicitDate: true },
      { timestamp: new Date("2026-08-12T12:00:00.000Z").getTime(), percent: 60, explicitDate: true },
    ]);

    expect([...result.byDay.entries()]).toEqual([["2026-08-11", 60]]);
    expect(result.lastExplicitTimestamp).toBe(new Date("2026-08-11T12:00:00.000Z").getTime());
  });
});
