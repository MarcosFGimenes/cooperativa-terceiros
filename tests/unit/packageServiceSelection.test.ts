import { describe, expect, it } from "vitest";

import { selectMissingFolderServices } from "@/lib/packageServiceSelection";

describe("selectMissingFolderServices", () => {
  it("carrega todos os serviços de subpacotes com mais de 110 itens", () => {
    const serviceIds = Array.from({ length: 120 }, (_, index) => `service-${index + 1}`);

    const selection = selectMissingFolderServices([serviceIds], []);

    expect(selection.folderServiceIds).toHaveLength(120);
    expect(selection.missingServiceIds).toEqual(serviceIds);
  });

  it("remove duplicados e ignora IDs já carregados sem truncar pacotes grandes", () => {
    const manyServiceIds = Array.from({ length: 700 }, (_, index) => `bulk-${index + 1}`);
    const selection = selectMissingFolderServices(
      [[" service-1 ", "service-2", "service-2"], ["service-3", ""], manyServiceIds],
      ["service-1"],
    );

    expect(selection.folderServiceIds).toHaveLength(703);
    expect(selection.missingServiceIds).toEqual(["service-2", "service-3", ...manyServiceIds]);
  });
});
