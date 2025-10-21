export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";

import { listRecentServices } from "@/lib/repo/services";
import type { Service } from "@/types";

function normaliseStatus(status: Service["status"]): string {
  const raw = String(status ?? "").toLowerCase();
  if (raw === "concluido" || raw === "concluído") return "Concluído";
  if (raw === "encerrado") return "Encerrado";
  return "Aberto";
}

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
          <Link className="btn-secondary" href="/dashboard">
            Voltar para o dashboard
          </Link>
          <Link className="btn-primary" href="/servicos/novo">
            + Novo Serviço
          </Link>
        </div>
      </div>

      {services.length === 0 ? (
        <div className="card p-6 text-sm text-muted-foreground">Nenhum serviço encontrado.</div>
      ) : (
        <div className="card divide-y">
          {services.map((service) => {
            const progress = Math.round(
              service.progress ?? service.realPercent ?? service.andamento ?? 0,
            );
            return (
              <Link
                key={service.id}
                className="flex items-center gap-3 p-4 transition hover:bg-muted/40"
                href={`/servicos/${service.id}`}
              >
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
      )}
    </div>
  );
}
