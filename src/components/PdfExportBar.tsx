"use client";

import { type RefObject, useCallback, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "sonner";

type PdfExportBarProps = {
  targetRef: RefObject<HTMLElement>;
  serviceName?: string | null;
  serviceOs?: string | null;
  company?: string | null;
  reportDate?: Date | string | number;
};

function formatDate(date?: Date | string | number | null) {
  if (!date) return "";
  const value =
    typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  if (Number.isNaN(value?.getTime?.())) return "";
  return value.toLocaleDateString("pt-BR");
}

export default function PdfExportBar({
  targetRef,
  serviceName,
  serviceOs,
  company,
  reportDate,
}: PdfExportBarProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleExportPdf = useCallback(async () => {
    const container = targetRef.current;
    if (!container) return;

    try {
      setIsExporting(true);
      const canvas = await html2canvas(container, { scale: 2, useCORS: true });
      const orientation = canvas.width > canvas.height ? "landscape" : "portrait";
      const pdf = new jsPDF({ orientation, unit: "pt", format: "a4" });

      const margin = 40;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      let cursorY = margin;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      const resolvedServiceName = serviceName?.trim() || "Relatório do Serviço";
      pdf.text(resolvedServiceName, margin, cursorY);
      cursorY += 18;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);

      const metaLines = [
        serviceOs?.trim() ? `OS: ${serviceOs}` : null,
        company?.trim() ? `Empresa: ${company}` : null,
        `Data: ${formatDate(reportDate) || formatDate(new Date())}`,
      ].filter((line): line is string => Boolean(line));

      metaLines.forEach((line) => {
        pdf.text(line, margin, cursorY);
        cursorY += 14;
      });

      const availableWidth = pageWidth - margin * 2;
      const availableHeight = pageHeight - cursorY - margin;
      const widthRatio = availableWidth / canvas.width;
      const heightRatio =
        availableHeight > 0 ? availableHeight / canvas.height : widthRatio;
      const tentativeRatio = Math.min(widthRatio, heightRatio, 1);
      const imageRatio =
        Number.isFinite(tentativeRatio) && tentativeRatio > 0
          ? tentativeRatio
          : Math.min(widthRatio, 1);

      const imageWidth = canvas.width * imageRatio;
      const imageHeight = canvas.height * imageRatio;
      const imageX = margin + (availableWidth - imageWidth) / 2;
      const imageY = cursorY + 12;

      const imageData = canvas.toDataURL("image/png");
      pdf.addImage(imageData, "PNG", imageX, imageY, imageWidth, imageHeight, undefined, "FAST");

      pdf.save(
        `${resolvedServiceName.replace(/\s+/g, "-").toLowerCase() || "relatorio-servico"}.pdf`,
      );
      toast.success("PDF gerado com sucesso");
    } catch (error) {
      console.error("[PdfExportBar] Falha ao exportar PDF", error);
      toast.error("Falha ao exportar PDF");
    } finally {
      setIsExporting(false);
    }
  }, [company, reportDate, serviceName, serviceOs, targetRef]);

  return (
    <div className="flex gap-2">
      <button type="button" onClick={handlePrint} className="btn btn-secondary">
        Imprimir
      </button>
      <button type="button" onClick={handleExportPdf} disabled={isExporting} className="btn btn-primary">
        {isExporting ? "Exportando…" : "Exportar PDF"}
      </button>
    </div>
  );
}
