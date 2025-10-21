export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";

import { listRecentPackages } from "@/lib/repo/packages";
import { listRecentServices } from "@/lib/repo/services";
import type { Service } from "@/types";

function normaliseStatus(status: Service["status"]): "Aberto" | "Concluído" | "Encerrado" {
  const raw = String(status ?? "").toLowerCase();
  if (raw === "concluido" || raw === "concluído") return "Concluído";
  if (raw === "encerrado") return "Encerrado";
  return "Aberto";
}

function formatDate(value?: number) {
  if (value === null || value === undefined) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Sao_Paulo",
    }).format(date);
  } catch (error) {
    return "";
  }
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
    { Aberto: 0, "Concluído": 0, "Encerrado": 0 } as Record<"Aberto" | "Concluído" | "Encerrado", number>,
  );

  return (
    <div className="container mx-auto space-y-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard PCM</h1>
          <p className="text-sm text-muted-foreground">Acompanhe cadastros recentes de serviços e pacotes.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="btn-primary" href="/servicos/novo">
            + Novo Serviço
          </Link>
          <Link className="btn-secondary" href="/pacotes/novo">
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
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Concluídos</p>
          <p className="text-2xl font-semibold">{statusGroups["Concluído"]}</p>
        </div>
        <div className="card space-y-1 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Encerrados</p>
          <p className="text-2xl font-semibold">{statusGroups["Encerrado"]}</p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Serviços recentes</h2>
              <p className="text-xs text-muted-foreground">Últimos cadastros com status e andamento.</p>
            </div>
            <Link className="btn-ghost" href="/servicos">
              Ver todos
            </Link>
          </div>
          <div className="space-y-2">
            {services.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Nenhum serviço cadastrado.
              </div>
            ) : (
              services.slice(0, 5).map((service) => {
                const progress = Math.round(
                  service.progress ?? service.realPercent ?? service.andamento ?? 0,
                );
                const createdAt = formatDate(service.createdAt);
                return (
                  <div
                    key={service.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg border p-3 transition hover:border-primary/40 hover:bg-muted/40"
                  >
                    <Link className="min-w-0 flex-1" href={`/servicos/${service.id}`}>
                      <p className="truncate text-sm font-medium">
                        {service.os || service.code || service.id}
                        {service.equipmentName
                          ? ` — ${service.equipmentName}`
                          : service.tag
                            ? ` — ${service.tag}`
                            : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {normaliseStatus(service.status)}
                        {createdAt ? ` • ${createdAt}` : ""}
                      </p>
                    </Link>
                    <span className="text-sm font-semibold text-primary">{progress}%</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Pacotes recentes</h2>
              <p className="text-xs text-muted-foreground">Últimos pacotes cadastrados.</p>
            </div>
            <Link className="btn-ghost" href="/pacotes">
              Ver todos
            </Link>
          </div>
          <div className="space-y-2">
            {packages.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Nenhum pacote cadastrado.
              </div>
            ) : (
              packages.slice(0, 5).map((pkg) => (
                <Link
                  key={pkg.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3 transition hover:border-primary/40 hover:bg-muted/40"
                  href={`/pacotes/${pkg.id}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{pkg.name || pkg.code || pkg.id}</p>
                    <p className="text-xs text-muted-foreground">{normaliseStatus(pkg.status)}</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
