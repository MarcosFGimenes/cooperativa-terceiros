"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import type { Service } from "@/types";

const MAX_VISIBLE_SERVICES = 8;

const STATUS_LABEL: Record<string, string> = {
  concluido: "Concluído",
  "concluído": "Concluído",
  encerrado: "Concluído",
  pendente: "Pendente",
  aberto: "Aberto",
};

const STATUS_TONE: Record<string, string> = {
  Concluído: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Pendente: "bg-amber-100 text-amber-700 border-amber-200",
  Aberto: "bg-sky-100 text-sky-700 border-sky-200",
};

function normaliseStatus(status: Service["status"]): string {
  const raw = String(status ?? "").trim().toLowerCase();
  return STATUS_LABEL[raw] ?? "Aberto";
}

function computeProgress(service: Service): number {
  const progress = Number(
    service.progress ?? service.realPercent ?? service.andamento ?? service.manualPercent ?? 0,
  );
  if (!Number.isFinite(progress)) return 0;
  return Math.max(0, Math.min(100, Math.round(progress)));
}

type Props = {
  services: Service[];
};

export default function ServicesListClient({ services }: Props) {
  const [showAll, setShowAll] = useState(false);
  const visibleServices = useMemo(() => {
    if (showAll) return services;
    return services.slice(0, MAX_VISIBLE_SERVICES);
  }, [services, showAll]);

  const total = services.length;
  const visibleCount = visibleServices.length;
  const hasToggle = total > MAX_VISIBLE_SERVICES;

  if (total === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visibleServices.map((service) => {
          const serviceHref = `/servicos/${encodeURIComponent(service.id)}`;
          const statusLabel = normaliseStatus(service.status);
          const statusTone = STATUS_TONE[statusLabel] ?? "border-border bg-muted text-foreground/80";
          const progress = computeProgress(service);
          const identifier = service.os || service.code || service.tag || service.id;
          const subtitle = service.equipmentName || service.setor || service.sector || "";
          const companyLabel =
            service.assignedTo?.companyName ||
            service.company ||
            service.assignedTo?.companyId ||
            undefined;
          return (
            <Link
              key={service.id}
              className="group flex flex-col gap-4 rounded-2xl border bg-card/80 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md focus-visible:outline-none focus-visible:ring"
              href={serviceHref}
            >
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusTone}`}>
                    {statusLabel}
                  </span>
                  <span className="rounded-full border border-transparent bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground">
                    {progress}% concluído
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="line-clamp-2 text-base font-semibold text-foreground">{identifier}</p>
                  {subtitle ? (
                    <p className="text-sm text-muted-foreground">{subtitle}</p>
                  ) : null}
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{companyLabel ? `Empresa: ${companyLabel}` : `Pacote: ${service.packageId ?? "Não vinculado"}`}</span>
                  <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground/80 transition group-hover:bg-primary/10 group-hover:text-primary">
                    Ver serviço
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      {hasToggle ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            Mostrando {visibleCount} de {total} serviço{total === 1 ? "" : "s"}.
          </span>
          <button type="button" className="btn btn-secondary" onClick={() => setShowAll((prev) => !prev)}>
            {showAll ? "Mostrar menos" : "Mostrar mais"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
