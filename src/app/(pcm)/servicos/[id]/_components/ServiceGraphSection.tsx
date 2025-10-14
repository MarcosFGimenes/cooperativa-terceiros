"use client";

import { useMemo, useRef } from "react";

import PdfExportBar from "@/components/PdfExportBar";
import SCurveChart from "@/components/charts/SCurveChart";
import type { Service } from "@/lib/types";

type ServiceGraphSectionProps = {
  service: Pick<
    Service,
    "id" | "os" | "equipmentName" | "company" | "tag" | "plannedStart" | "plannedEnd"
  >;
};

export default function ServiceGraphSection({ service }: ServiceGraphSectionProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const reportDate = useMemo(() => new Date(), []);
  const serviceName = useMemo(() => {
    const name = service.equipmentName?.trim();
    if (name) return name;
    const tag = service.tag?.trim();
    if (tag) return tag;
    return `Serviço ${service.id}`;
  }, [service.equipmentName, service.id, service.tag]);

  const plannedPeriod = useMemo(() => {
    const start = service.plannedStart ? new Date(service.plannedStart) : null;
    const end = service.plannedEnd ? new Date(service.plannedEnd) : null;
    const format = (date: Date | null) => {
      if (!date || Number.isNaN(date.getTime())) return "—";
      return date.toLocaleDateString("pt-BR");
    };
    if (!start && !end) return "";
    return `${format(start)} até ${format(end)}`;
  }, [service.plannedEnd, service.plannedStart]);

  return (
    <section className="space-y-4 rounded-lg border bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <PdfExportBar
          targetRef={printRef}
          serviceName={serviceName}
          serviceOs={service.os || service.id}
          company={service.company}
          reportDate={reportDate}
        />
      </div>

      <div ref={printRef} className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-gray-900">Curva S</h2>
          <p className="text-sm text-gray-500">
            Compare a evolução planejada com o progresso real do serviço.
          </p>
        </div>

        <div className="grid gap-4 text-sm text-gray-600 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="font-semibold text-gray-800">Serviço:</span>
            <div>{serviceName}</div>
          </div>
          <div>
            <span className="font-semibold text-gray-800">OS:</span>
            <div>{service.os || "—"}</div>
          </div>
          <div>
            <span className="font-semibold text-gray-800">Empresa:</span>
            <div>{service.company || "—"}</div>
          </div>
          <div>
            <span className="font-semibold text-gray-800">Período planejado:</span>
            <div>{plannedPeriod || "—"}</div>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-4">
          <SCurveChart serviceId={service.id} />
        </div>
      </div>
    </section>
  );
}
