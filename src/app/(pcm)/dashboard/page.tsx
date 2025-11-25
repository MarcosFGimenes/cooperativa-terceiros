export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";

import { listRecentPackages } from "@/lib/repo/packages";
import { countServicesByStatus, listRecentServices } from "@/lib/repo/services";
import ImportServicesButton from "./_components/ImportServicesButton";
import RecentPackagesPanel from "./_components/RecentPackagesPanel";
import RecentServicesPanel from "./_components/RecentServicesPanel";

export default async function DashboardPCM() {
  const [recentServices, packages, statusCounts] = await Promise.all([
    listRecentServices(),
    listRecentPackages(),
    countServicesByStatus(),
  ]);

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
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Serviços</p>
          <p className="text-2xl font-semibold">{statusCounts.total}</p>
        </div>
        <div className="card space-y-1 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Abertos</p>
          <p className="text-2xl font-semibold">{statusCounts.aberto}</p>
        </div>
        <div className="card space-y-1 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Pendentes</p>
          <p className="text-2xl font-semibold">{statusCounts.pendente}</p>
        </div>
        <div className="card space-y-1 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Concluídos</p>
          <p className="text-2xl font-semibold">{statusCounts.concluido}</p>
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
            <RecentServicesPanel services={recentServices} />
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
          <RecentPackagesPanel packages={packages} />
        </div>
      </section>
    </div>
  );
}
