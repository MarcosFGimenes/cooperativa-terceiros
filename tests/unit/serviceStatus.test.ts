import { describe, expect, it } from "vitest";

import { resolveCanonicalServiceStatus, resolveDisplayedServiceStatus } from "@/lib/serviceStatus";
import type { Service } from "@/types";

function service(overrides: Partial<Service> = {}): Service {
  return {
    id: "service-1",
    os: "OS-1",
    equipmentName: "Equipamento",
    plannedStart: "2026-01-01",
    plannedEnd: "2026-01-02",
    totalHours: 8,
    status: "Aberto",
    createdAt: 0,
    ...overrides,
  };
}

describe("displayed service status", () => {
  it("marks any service at 100% as concluded", () => {
    expect(resolveDisplayedServiceStatus(service({ status: "Aberto", progress: 100 }))).toBe(
      "Concluído",
    );
  });

  it("keeps a reopened pending service pending using its previous progress", () => {
    const reopened = service({ status: "Pendente", progress: 100, previousProgress: 63 });
    expect(resolveDisplayedServiceStatus(reopened)).toBe("Pendente");
    expect(resolveCanonicalServiceStatus(reopened)).toBe("Pendente");
  });

  it("maps non-dashboard labels to the existing open dashboard group", () => {
    expect(resolveCanonicalServiceStatus(service({ status: "Aberto", progress: 25 }))).toBe(
      "Aberto",
    );
  });
});
