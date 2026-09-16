import { describe, expect, it } from "vitest";

import {
  resolveLastUpdateStage,
  sortPublicSubpackageServices,
  type PublicSubpackageService,
} from "@/lib/subpackageServices";

function service(
  id: string,
  title: string,
  progress: number,
  status = progress >= 100 ? "Concluído" : "Aberto",
): PublicSubpackageService {
  return { id, title, progress, status, subtitle: null, tag: null, description: null, lastUpdateAt: null };
}

describe("subpackage services", () => {
  it("lista serviços não concluídos antes dos concluídos", () => {
    const result = sortPublicSubpackageServices([
      service("done-a", "OS A", 100),
      service("open-c", "OS C", 30),
      service("open-b", "OS B", 80),
      service("done-d", "OS D", 100),
    ]);

    expect(result.map((item) => item.id)).toEqual(["open-b", "open-c", "done-a", "done-d"]);
  });

  it("classifica a última atualização em hoje, ontem e antes no horário de São Paulo", () => {
    const now = Date.parse("2026-09-16T15:00:00Z");
    expect(resolveLastUpdateStage(Date.parse("2026-09-16T12:00:00Z"), now)).toBe("today");
    expect(resolveLastUpdateStage(Date.parse("2026-09-15T12:00:00Z"), now)).toBe("yesterday");
    expect(resolveLastUpdateStage(Date.parse("2026-09-14T12:00:00Z"), now)).toBe("before");
    expect(resolveLastUpdateStage(null, now)).toBe("before");
  });
});
