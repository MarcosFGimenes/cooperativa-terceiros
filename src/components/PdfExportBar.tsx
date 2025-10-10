"use client";
import { useRef } from "react";
import { exportSectionToPdf } from "@/lib/pdf";
import { useReactToPrint } from "react-to-print";

export default function PdfExportBar({ targetId, filename }:{ targetId: string; filename: string }) {
  const print = useReactToPrint({ content: () => document.getElementById(targetId) } as any);
  async function doPdf() {
    const el = document.getElementById(targetId);
    if (el) await exportSectionToPdf(el, filename);
  }
  return (
    <div className="flex gap-2">
      <button onClick={print} className="px-3 py-2 border rounded">Imprimir</button>
      <button onClick={doPdf} className="px-3 py-2 bg-black text-white rounded">Exportar PDF</button>
    </div>
  );
}
