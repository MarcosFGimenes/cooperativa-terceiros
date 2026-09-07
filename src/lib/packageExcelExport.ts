export type PackageServiceExportRow = {
  os: string;
  tag: string;
  equipment: string;
  description: string;
  progress: number;
  company: string;
};

const XML_HEADER = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>`;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function textCell(value: string, styleId?: string): string {
  const style = styleId ? ` ss:StyleID="${styleId}"` : "";
  return `<Cell${style}><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`;
}

function progressCell(progress: number): string {
  const safeProgress = Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0;
  return `<Cell ss:StyleID="Percent"><Data ss:Type="Number">${safeProgress / 100}</Data></Cell>`;
}

export function buildPackageServicesExcel(rows: PackageServiceExportRow[]): string {
  const header = ["O.S", "TAG", "Equipamento", "Descrição do Serviço", "Porcentagem Atual", "Empresa"]
    .map((label) => textCell(label, "Header"))
    .join("");
  const body = rows
    .map(
      (row) =>
        `<Row>${textCell(row.os)}${textCell(row.tag)}${textCell(row.equipment)}${textCell(row.description)}${progressCell(row.progress)}${textCell(row.company)}</Row>`,
    )
    .join("");

  return `${XML_HEADER}
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Header"><Font ss:Bold="1"/><Interior ss:Color="#D9EAF7" ss:Pattern="Solid"/></Style>
  <Style ss:ID="Percent"><NumberFormat ss:Format="0.00%"/></Style>
 </Styles>
 <Worksheet ss:Name="Andamento dos serviços">
  <Table>
   <Column ss:Width="110"/><Column ss:Width="110"/><Column ss:Width="190"/><Column ss:Width="260"/><Column ss:Width="120"/><Column ss:Width="190"/>
   <Row>${header}</Row>${body}
  </Table>
 </Worksheet>
</Workbook>`;
}

export function buildPackageExcelFilename(packageLabel: string): string {
  const safeLabel = packageLabel
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `andamento-${safeLabel || "pacote"}.xls`;
}
