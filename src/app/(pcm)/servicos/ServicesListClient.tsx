"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import type { Service } from "@/types";

const MAX_VISIBLE_SERVICES = 5;

function normaliseStatus(status: Service["status"]): string {
  const raw = String(status ?? "").toLowerCase();
  if (raw === "concluido" || raw === "concluído" || raw === "encerrado") return "Concluído";
  if (raw === "pendente") return "Pendente";
  return "Aberto";
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
    <div className="space-y-3">
      <div className="card divide-y">
        {visibleServices.map((service) => {
          const progress = Math.round(service.progress ?? service.realPercent ?? service.andamento ?? 0);
          const serviceHref = `/servicos/${encodeURIComponent(service.id)}`;
          return (
            <Link key={service.id} className="flex items-center gap-3 p-4 transition hover:bg-muted/40" href={serviceHref}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {service.os || service.code || service.id}
                  {service.equipmentName
                    ? ` — ${service.equipmentName}`
                    : service.tag
                      ? ` — ${service.tag}`
                      : ""}
                </p>
                <p className="text-xs text-muted-foreground">{normaliseStatus(service.status)}</p>
              </div>
              <span className="text-sm font-semibold text-primary">{progress}%</span>
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
