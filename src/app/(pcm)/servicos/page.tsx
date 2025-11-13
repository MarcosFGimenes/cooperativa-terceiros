export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";

import { listRecentServices } from "@/lib/repo/services";

import ServicesListClient from "./ServicesListClient";

export default async function ServicesListPage() {
  const services = await listRecentServices();

  return (
    <div className="container mx-auto space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Serviços</h1>
          <p className="text-sm text-muted-foreground">Cadastros recentes com acesso rápido aos detalhes.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link className="btn btn-secondary" href="/dashboard">
            Voltar para o dashboard
          </Link>
          <Link className="btn btn-primary" href="/servicos/novo">
            + Novo Serviço
          </Link>
        </div>
      </div>

      {services.length === 0 ? (
        <div className="card p-6 text-sm text-muted-foreground">Nenhum serviço encontrado.</div>
      ) : (
        <ServicesListClient services={services} />
      )}
    </div>
  );
}
