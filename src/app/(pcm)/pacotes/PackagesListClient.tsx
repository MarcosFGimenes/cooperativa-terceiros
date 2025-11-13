"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import type { Package } from "@/types";

const MAX_VISIBLE_PACKAGES = 5;

function normaliseStatus(status: Package["status"]): string {
  const raw = String(status ?? "").toLowerCase();
  if (raw === "concluido" || raw === "concluído") return "Concluído";
  if (raw === "encerrado") return "Encerrado";
  return "Aberto";
}

type Props = {
  packages: Package[];
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
    <div className="space-y-3">
      <div className="card divide-y">
        {visiblePackages.map((pkg) => {
          const packageHref = `/pacotes/${encodeURIComponent(pkg.id)}`;
          return (
            <Link
              key={pkg.id}
              className="flex items-center justify-between gap-3 p-4 transition hover:bg-muted/40"
              href={packageHref}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{pkg.name || pkg.code || pkg.id}</p>
                <p className="text-xs text-muted-foreground">{normaliseStatus(pkg.status)}</p>
              </div>
              <span className="text-xs text-muted-foreground">
                {pkg.services?.length ? `${pkg.services.length} serviço${pkg.services.length === 1 ? "" : "s"}` : ""}
              </span>
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
