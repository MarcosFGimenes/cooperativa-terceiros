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
    <section className="card space-y-6 p-6">
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
          <h2 className="text-lg font-semibold tracking-tight">Curva S</h2>
          <p className="text-sm text-muted-foreground">
            Compare a evolução planejada com o progresso real do serviço.
          </p>
        </div>

        <div className="grid gap-4 rounded-lg border border-border/70 bg-muted/40 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Serviço</span>
            <p className="mt-1 font-medium text-foreground">{serviceName}</p>
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">OS</span>
            <p className="mt-1 font-medium text-foreground">{service.os || "—"}</p>
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Empresa</span>
            <p className="mt-1 font-medium text-foreground">{service.company || "—"}</p>
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Período planejado</span>
            <p className="mt-1 font-medium text-foreground">{plannedPeriod || "—"}</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-background p-4">
          <SCurveChart serviceId={service.id} />
        </div>
      </div>
    </section>
  );
}
