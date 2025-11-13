"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import type { PackageSummary } from "@/lib/repo/packages";

const MAX_VISIBLE_PACKAGES = 6;

const STATUS_LABEL: Record<string, string> = {
  concluido: "Concluído",
  "concluído": "Concluído",
  encerrado: "Encerrado",
  aberto: "Aberto",
};

const STATUS_TONE: Record<string, string> = {
  Concluído: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Encerrado: "bg-slate-200 text-slate-700 border-slate-300",
  Aberto: "bg-sky-100 text-sky-700 border-sky-200",
};

const DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
});

function normaliseStatus(status: PackageSummary["status"]): string {
  const raw = String(status ?? "").trim().toLowerCase();
  return STATUS_LABEL[raw] ?? "Aberto";
}

function formatCreatedAt(timestamp?: number | null) {
  if (!timestamp || !Number.isFinite(timestamp)) return "";
  try {
    return DATE_FORMATTER.format(new Date(timestamp));
  } catch (error) {
    console.warn("[PackagesListClient] Failed to format creation date", timestamp, error);
    return "";
  }
}

type Props = {
  packages: PackageSummary[];
};

export default function PackagesListClient({ packages }: Props) {
  const [showAll, setShowAll] = useState(false);
  const visiblePackages = useMemo(() => {
    if (showAll) return packages;
    return packages.slice(0, MAX_VISIBLE_PACKAGES);
  }, [packages, showAll]);
  const total = packages.length;
  const visibleCount = visiblePackages.length;
  const hasToggle = total > MAX_VISIBLE_PACKAGES;

  if (total === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visiblePackages.map((pkg) => {
          const packageHref = `/pacotes/${encodeURIComponent(pkg.id)}`;
          const statusLabel = normaliseStatus(pkg.status);
          const statusTone = STATUS_TONE[statusLabel] ?? "border-border bg-muted text-foreground/80";
          const servicesLabel = pkg.servicesCount
            ? `${pkg.servicesCount} serviço${pkg.servicesCount === 1 ? "" : "s"}`
            : "Sem serviços";
          const createdAtLabel = formatCreatedAt(pkg.createdAt);
          return (
            <Link
              key={pkg.id}
              className="group flex flex-col justify-between gap-4 rounded-2xl border bg-card/80 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md focus-visible:outline-none focus-visible:ring"
              href={packageHref}
            >
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusTone}`}>
                    {statusLabel}
                  </span>
                  {createdAtLabel ? (
                    <span className="rounded-full border border-transparent bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground">
                      Criado em {createdAtLabel}
                    </span>
                  ) : null}
                </div>
                <p className="line-clamp-2 text-base font-semibold text-foreground">
                  {pkg.name || pkg.code || pkg.id}
                </p>
                {pkg.code ? (
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Código: {pkg.code}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                <span>{servicesLabel}</span>
                <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground/80 transition group-hover:bg-primary/10 group-hover:text-primary">
                  Ver detalhes
                </span>
              </div>
            </Link>
          );
        })}
      </div>
      {hasToggle ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            Mostrando {visibleCount} de {total} pacote{total === 1 ? "" : "s"}.
          </span>
          <button type="button" className="btn btn-secondary" onClick={() => setShowAll((prev) => !prev)}>
            {showAll ? "Mostrar menos" : "Mostrar mais"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
