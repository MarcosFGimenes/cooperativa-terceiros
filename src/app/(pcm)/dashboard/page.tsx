export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";

import { listRecentPackages } from "@/lib/repo/packages";
import { listRecentServices } from "@/lib/repo/services";
import type { Service } from "@/types";
import ImportServicesButton from "./_components/ImportServicesButton";
import RecentServicesPanel from "./_components/RecentServicesPanel";

function normaliseStatus(status: Service["status"]): "Aberto" | "Pendente" | "Concluído" {
  const raw = String(status ?? "").toLowerCase();
  if (raw === "concluido" || raw === "concluído" || raw === "encerrado") return "Concluído";
  if (raw === "pendente") return "Pendente";
  return "Aberto";
}

export default async function DashboardPCM() {
  const [services, packages] = await Promise.all([
    listRecentServices(),
    listRecentPackages(),
  ]);

  const statusGroups = services.reduce(
    (acc, service) => {
      const key = normaliseStatus(service.status);
      acc[key] += 1;
      return acc;
    },
    { Aberto: 0, Pendente: 0, "Concluído": 0 } as Record<"Aberto" | "Pendente" | "Concluído", number>,
  );

  return (
    <div className="container mx-auto space-y-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard PCM</h1>
          <p className="text-sm text-muted-foreground">Acompanhe cadastros recentes de serviços e pacotes.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="btn btn-primary" href="/servicos/novo">
            + Novo Serviço
          </Link>
          <ImportServicesButton />
          <Link className="btn btn-secondary" href="/pacotes/novo">
            + Novo Pacote
          </Link>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card space-y-1 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Serviços (recentes)</p>
          <p className="text-2xl font-semibold">{services.length}</p>
        </div>
        <div className="card space-y-1 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Abertos</p>
          <p className="text-2xl font-semibold">{statusGroups.Aberto}</p>
        </div>
        <div className="card space-y-1 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Pendentes</p>
          <p className="text-2xl font-semibold">{statusGroups.Pendente}</p>
        </div>
        <div className="card space-y-1 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Concluídos</p>
          <p className="text-2xl font-semibold">{statusGroups["Concluído"]}</p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Serviços recentes</h2>
              <p className="text-xs text-muted-foreground">Últimos cadastros com status e andamento.</p>
            </div>
            <Link className="btn btn-ghost" href="/servicos">
              Ver todos
            </Link>
          </div>
          <div className="space-y-2">
            <RecentServicesPanel services={services} />
          </div>
        </div>

        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Pacotes recentes</h2>
              <p className="text-xs text-muted-foreground">Últimos pacotes cadastrados.</p>
            </div>
            <Link className="btn btn-ghost" href="/pacotes">
              Ver todos
            </Link>
          </div>
          <div className="space-y-2">
            {packages.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Nenhum pacote cadastrado.
              </div>
            ) : (
              packages.slice(0, 5).map((pkg) => {
                const packageHref = `/pacotes/${encodeURIComponent(pkg.id)}`;
                return (
                  <Link
                    key={pkg.id}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3 transition hover:border-primary/40 hover:bg-muted/40"
                    href={packageHref}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{pkg.name || pkg.code || pkg.id}</p>
                      <p className="text-xs text-muted-foreground">{normaliseStatus(pkg.status)}</p>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
