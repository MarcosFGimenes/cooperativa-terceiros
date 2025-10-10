import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export async function exportSectionToPdf(element: HTMLElement, filename = "relatorio.pdf") {
  const canvas = await html2canvas(element, { scale: 2 });
  const img = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  pdf.addImage(img, "PNG", 0, 0, pageW, (canvas.height * pageW) / canvas.width);
  pdf.save(filename);
}
