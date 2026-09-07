import { describe, expect, it } from "vitest";
import { buildPackageExcelFilename, buildPackageServicesExcel } from "@/lib/packageExcelExport";

describe("package Excel export", () => {
  it("exports one row per service in the requested column order", () => {
    const workbook = buildPackageServicesExcel([
      {
        os: "OS-10",
        tag: "TAG-2",
        equipment: "Bomba",
        description: "Troca do selo mecânico",
        progress: 42.5,
        company: "Empresa A",
      },
      {
        os: "OS-11",
        tag: "TAG-3",
        equipment: "Motor",
        description: "Revisão elétrica",
        progress: 100,
        company: "Empresa B",
      },
    ]);

    expect(workbook).toContain("O.S");
    expect(workbook).toContain("TAG");
    expect(workbook).toContain("Equipamento");
    expect(workbook).toContain("Descrição do Serviço");
    expect(workbook).toContain("Porcentagem Atual");
    expect(workbook).toContain("Empresa");
    expect(workbook).toContain('<Data ss:Type="Number">0.425</Data>');
    expect(workbook.match(/<Row>/g)).toHaveLength(3);
    expect(workbook.indexOf("OS-10")).toBeLessThan(workbook.indexOf("TAG-2"));
    expect(workbook.indexOf("TAG-2")).toBeLessThan(workbook.indexOf("Bomba"));
    expect(workbook.indexOf("Bomba")).toBeLessThan(workbook.indexOf("Troca do selo mecânico"));
    expect(workbook.indexOf("Troca do selo mecânico")).toBeLessThan(workbook.indexOf("0.425"));
  });

  it("escapes spreadsheet content and creates a safe filename", () => {
    const workbook = buildPackageServicesExcel([
      {
        os: "A&B",
        tag: "<tag>",
        equipment: 'Equipamento "1"',
        description: "Inspeção & reparo",
        progress: 0,
        company: "A > B",
      },
    ]);

    expect(workbook).toContain("A&amp;B");
    expect(workbook).toContain("&lt;tag&gt;");
    expect(workbook).toContain("Equipamento &quot;1&quot;");
    expect(workbook).toContain("Inspeção &amp; reparo");
    expect(buildPackageExcelFilename("Pacote Ácido / 2026")).toBe("andamento-pacote-acido-2026.xls");
  });
});
