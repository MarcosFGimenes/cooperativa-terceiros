import { describe, expect, it } from "vitest";

import {
  buildStableUpdateKey,
  dedupeUpdates,
  formatResourcesLine,
  formatUpdateSummary,
  sanitiseResourceQuantities,
} from "@/lib/serviceUpdates";

describe("serviceUpdates helpers", () => {
  it("sanitises resource quantities less than or equal to zero", () => {
    const update = sanitiseResourceQuantities({
      resources: [
        { name: "Máquina de solda", quantity: 0, unit: "un" },
        { name: "Guindaste", quantity: 2 },
      ],
    });

    expect(update.resources?.[0]?.quantity).toBeNull();
    expect(update.resources?.[1]?.quantity).toBe(2);
  });

  it("formats resources without zero quantities", () => {
    const label = formatResourcesLine([
      { name: "Máquina de solda", quantity: null },
      { name: "Guindaste", quantity: 2, unit: "un" },
    ]);

    expect(label).toBe("Máquina de solda, Guindaste • 2 un");
  });

  it("builds stable keys prioritising document id", () => {
    const key = buildStableUpdateKey({ id: "doc-123", description: "" });
    expect(key).toBe("id:doc-123");
  });

  it("deduplicates updates keeping the newest entry", () => {
    const [latest] = dedupeUpdates([
      {
        id: "firestore-1",
        description: "Soldagem", 
        createdAt: 1700000000000,
        percent: 40,
      },
      {
        id: "",
        description: "Soldagem",
        createdAt: 1700000001000,
        percent: 40,
      },
    ]);

    expect(latest.id).toBe("firestore-1");
  });

  it("produces formatted summaries following the specification", () => {
    const summary = formatUpdateSummary({
      id: "u-1",
      createdAt: new Date("2024-05-03T12:00:00Z").getTime(),
      percent: 35,
      description: "Fiz soldas",
      timeWindow: {
        start: new Date("2024-05-03T08:00:00-03:00").getTime(),
        end: new Date("2024-05-03T17:00:00-03:00").getTime(),
        hours: 9,
      },
      resources: [{ name: "Soldadora" }],
    } as unknown as Parameters<typeof formatUpdateSummary>[0]);

    expect(summary.title).toBe("03/05/2024");
    expect(summary.description).toBe("Descrição do dia: Fiz soldas");
    expect(summary.hoursLabel).toBe("Horas informadas: 9.00");
    expect(summary.resources).toBe("Soldadora");
  });
});
