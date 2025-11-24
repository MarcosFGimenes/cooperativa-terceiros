"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import ReferenceDateSelector from "@/components/ReferenceDateSelector";
import { formatDateTime } from "@/lib/formatDateTime";
import { formatReferenceLabel, resolveReferenceDate } from "@/lib/referenceDate";
import { resolveServicoPercentualPlanejado, resolveServicoRealPercent } from "@/lib/serviceProgress";
import type { Service } from "@/types";

function normaliseStatus(status: Service["status"]): "Aberto" | "Pendente" | "Concluído" {
  const raw = String(status ?? "").toLowerCase();
  if (raw === "concluido" || raw === "concluído" || raw === "encerrado") return "Concluído";
  if (raw === "pendente") return "Pendente";
  return "Aberto";
}

export default function RecentServicesPanel({ services }: { services: Service[] }) {
  const searchParams = useSearchParams();
  const refDateParam = searchParams?.get("refDate") ?? null;
  const { date: referenceDate, inputValue: referenceDateInput } = useMemo(
    () => resolveReferenceDate(refDateParam),
    [refDateParam],
  );
  const referenceLabel = useMemo(() => formatReferenceLabel(referenceDate), [referenceDate]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-dashed border-border/70 bg-muted/20 p-3">
        <div className="space-y-1 text-sm text-muted-foreground">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Data de referência</p>
          <p className="font-semibold text-foreground">{referenceLabel}</p>
          <p className="text-[13px]">Planejado e realizado calculados com pesos por horas previstas.</p>
        </div>
        <div className="w-full max-w-[220px]">
          <ReferenceDateSelector value={referenceDateInput} />
        </div>
      </div>

      {services.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          Nenhum serviço cadastrado.
        </div>
      ) : (
        services.slice(0, 5).map((service) => {
          const plannedPercent = Math.round(resolveServicoPercentualPlanejado(service, referenceDate));
          const realPercent = Math.round(resolveServicoRealPercent(service, referenceDate));
          const createdAt = (service as { createdAt?: number | null }).createdAt;
          const serviceHref = `/servicos/${encodeURIComponent(service.id)}`;
          return (
            <div
              key={service.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border p-3 transition hover:border-primary/40 hover:bg-muted/40"
            >
              <Link className="min-w-0 flex-1" href={serviceHref}>
                <p className="truncate text-sm font-medium">
                  {service.os || service.code || service.id}
                  {service.equipmentName ? ` — ${service.equipmentName}` : service.tag ? ` — ${service.tag}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {normaliseStatus(service.status)}
                  {createdAt ? ` • ${formatDateTime(createdAt, { timeZone: "America/Sao_Paulo", fallback: "" })}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  Planejado ({referenceLabel}): <span className="font-semibold text-foreground">{plannedPercent}%</span>
                  {" "}| Real ({referenceLabel}): <span className="font-semibold text-foreground">{realPercent}%</span>
                </p>
              </Link>
            </div>
          );
        })
      )}
    </div>
  );
}
