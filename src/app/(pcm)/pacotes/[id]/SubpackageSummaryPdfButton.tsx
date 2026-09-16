"use client";

import { FileDown } from "lucide-react";
import { useCallback } from "react";

const PRINT_CLASS = "print-subpackage-summary";
const PRINT_STYLE_ID = "subpackage-summary-page-style";

function finishPrint() {
  document.body.classList.remove(PRINT_CLASS);
  document.documentElement.style.removeProperty("--subpackage-print-scale");
  document.getElementById(PRINT_STYLE_ID)?.remove();
}

export default function SubpackageSummaryPdfButton() {
  const handlePrint = useCallback(() => {
    const summary = document.getElementById("subpackage-summary-print");
    if (!summary) return;

    const pageStyle = document.createElement("style");
    pageStyle.id = PRINT_STYLE_ID;
    pageStyle.textContent = "@page { size: A4 landscape; margin: 8mm; }";
    document.head.appendChild(pageStyle);

    document.body.classList.add(PRINT_CLASS);

    // Reduce the complete summary when necessary so it remains on a single A4 sheet.
    // The values approximate the printable area at 96 dpi; the browser still applies
    // the exact printer margins from the @page rule above.
    const widthScale = 1040 / Math.max(summary.scrollWidth, 1);
    const heightScale = 680 / Math.max(summary.scrollHeight, 1);
    const scale = Math.min(1, widthScale, heightScale);
    document.documentElement.style.setProperty("--subpackage-print-scale", String(scale));

    window.addEventListener("afterprint", finishPrint, { once: true });
    window.print();
  }, []);

  return (
    <button type="button" className="btn btn-outline print:hidden" onClick={handlePrint}>
      <FileDown aria-hidden="true" className="h-4 w-4" />
      Exportar PDF
    </button>
  );
}
