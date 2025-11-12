export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";

import { listRecentPackages } from "@/lib/repo/packages";
import type { Package } from "@/types";

function normaliseStatus(status: Package["status"]): string {
  const raw = String(status ?? "").toLowerCase();
  if (raw === "concluido" || raw === "concluído") return "Concluído";
  if (raw === "encerrado") return "Encerrado";
  return "Aberto";
}

export default async function PackagesListPage() {
  const packages = await listRecentPackages();

  return (
    <div className="container mx-auto space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pacotes</h1>
          <p className="text-sm text-muted-foreground">Agrupamentos de serviços com acesso rápido aos detalhes.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link className="btn btn-secondary" href="/dashboard">
            Voltar para o dashboard
          </Link>
          <Link className="btn btn-primary" href="/pacotes/novo">
            + Novo Pacote
          </Link>
        </div>
      </div>

      {packages.length === 0 ? (
        <div className="card p-6 text-sm text-muted-foreground">Nenhum pacote encontrado.</div>
      ) : (
        <div className="card divide-y">
          {packages.map((pkg) => {
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
                  {pkg.services?.length ? `${pkg.services.length} serviços` : ""}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
