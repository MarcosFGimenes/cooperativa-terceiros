export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";

import { listRecentPackages } from "@/lib/repo/packages";

import PackagesListClient from "./PackagesListClient";

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
        <PackagesListClient packages={packages} />
      )}
    </div>
  );
}
