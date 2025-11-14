export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";

import { listRecentServices } from "@/lib/repo/services";

import ServicesListClient from "./ServicesListClient";

export default async function ServicesListPage() {
  const services = await listRecentServices();

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-6">
      <div className="flex flex-col gap-4 rounded-2xl border bg-card/80 p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Serviços</h1>
          <p className="text-sm text-muted-foreground">
            Cadastros recentes com resumo de status, progresso e acesso direto ao acompanhamento diário.
          </p>
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
        <div className="rounded-2xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          Nenhum serviço encontrado.
        </div>
      ) : (
        <ServicesListClient services={services} />
      )}
    </div>
  );
}
