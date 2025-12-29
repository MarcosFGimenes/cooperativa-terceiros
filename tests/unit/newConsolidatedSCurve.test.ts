import { describe, expect, it } from "vitest";

import { buildConsolidatedSCurve } from "@/lib/newConsolidatedSCurve";

const TIME_ZONE = "UTC";

describe("buildConsolidatedSCurve", () => {
  it("respects worked day updates with forward-fill", () => {
    const { realizedSeries, timeline } = buildConsolidatedSCurve({
      timeZone: TIME_ZONE,
      services: [
        {
          plannedStart: "2024-12-27",
          plannedEnd: "2024-12-31",
          totalHours: 10,
          updates: [
            {
              reportDate: "2024-12-28",
              createdAt: "2024-12-29T10:00:00Z",
              percent: 20,
            },
            {
              reportDate: "2024-12-30",
              createdAt: "2024-12-29T12:00:00Z",
              percent: 50,
            },
          ],
        },
      ],
    });

    expect(timeline).toEqual([
      "2024-12-27",
      "2024-12-28",
      "2024-12-29",
      "2024-12-30",
      "2024-12-31",
    ]);

    expect(realizedSeries.map((point) => point.percent)).toEqual([0, 20, 20, 50, 50]);
  });

  it("calculates weighted realized percent across services", () => {
    const { realizedSeries } = buildConsolidatedSCurve({
      timeZone: TIME_ZONE,
      services: [
        {
          plannedStart: "2024-01-01",
          plannedEnd: "2024-01-03",
          totalHours: 10,
          updates: [{ reportDate: "2024-01-01", percent: 20 }],
        },
        {
          plannedStart: "2024-01-01",
          plannedEnd: "2024-01-03",
          totalHours: 20,
          updates: [{ reportDate: "2024-01-02", percent: 40 }],
        },
      ],
    });

    expect(realizedSeries.map((point) => point.percent)).toHaveLength(3);
    expect(realizedSeries[0]?.percent).toBeCloseTo((20 * 10 + 0 * 20) / 30, 5);
    expect(realizedSeries[1]?.percent).toBeCloseTo((20 * 10 + 40 * 20) / 30, 5);
    expect(realizedSeries[2]?.percent).toBeCloseTo((20 * 10 + 40 * 20) / 30, 5);
  });

  it("falls back to createdAt when worked day is missing", () => {
    const { realizedSeries } = buildConsolidatedSCurve({
      timeZone: TIME_ZONE,
      services: [
        {
          plannedStart: "2024-02-02",
          plannedEnd: "2024-02-04",
          totalHours: 8,
          updates: [
            {
              createdAt: "2024-02-03T08:00:00Z",
              percent: 80,
            },
          ],
        },
      ],
    });

    expect(realizedSeries.map((point) => point.percent)).toEqual([0, 80, 80]);
  });
});
