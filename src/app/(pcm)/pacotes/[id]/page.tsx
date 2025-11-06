export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { notFound } from "next/navigation";

import SCurve from "@/components/SCurve";
import { plannedCurve } from "@/lib/curve";
import { getPackageById, listPackageServices } from "@/lib/repo/packages";
import { getServiceById } from "@/lib/repo/services";
import type { Package, Service } from "@/types";

import PackageTokenManager from "./PackageTokenManager";

function normaliseStatus(status: Package["status"] | Service["status"]): string {
  const raw = String(status ?? "").toLowerCase();
  if (raw === "concluido" || raw === "concluído") return "Concluído";
  if (raw === "encerrado") return "Encerrado";
  return "Aberto";
}

function normaliseProgress(value?: number | null) {
  if (!Number.isFinite(value ?? NaN)) return 0;
  return Math.max(0, Math.min(100, Math.round(Number(value ?? 0))));
}

function parseISO(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function formatDate(value?: string | null) {
  const date = parseISO(value ?? undefined);
  if (!date) return "-";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(date);
}

function computeServiceRealized(service: Service) {
  return normaliseProgress(service.progress ?? service.realPercent ?? service.andamento);
}

function choosePlanBounds(pkg: Package, services: Service[]) {
  const startCandidates = [pkg.plannedStart, ...services.map((service) => service.plannedStart)].map(parseISO).filter(Boolean) as Date[];
  const endCandidates = [pkg.plannedEnd, ...services.map((service) => service.plannedEnd)].map(parseISO).filter(Boolean) as Date[];
  const start = startCandidates.length ? new Date(Math.min(...startCandidates.map((date) => date.getTime()))) : new Date();
  const end = endCandidates.length ? new Date(Math.max(...endCandidates.map((date) => date.getTime()))) : start;
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function buildPackageRealizedSeries(planned: ReturnType<typeof plannedCurve>, realizedPercent: number) {
  if (!planned.length) {
    const today = new Date().toISOString().slice(0, 10);
    return [
      { date: today, percent: 0 },
      { date: today, percent: realizedPercent },
    ];
  }

  const first = planned[0];
  const last = planned[planned.length - 1];
  if (!first || !last) {
    const day = first?.date ?? new Date().toISOString().slice(0, 10);
    return [
      { date: day, percent: 0 },
      { date: day, percent: realizedPercent },
    ];
  }

  if (planned.length === 1 || first.date === last.date) {
    return [
      { date: first.date, percent: 0 },
      { date: last.date, percent: realizedPercent },
    ];
  }

  return [
    { date: first.date, percent: 0 },
    { date: last.date, percent: realizedPercent },
  ];
}

export default async function PackageDetailPage({ params }: { params: { id: string } }) {
  const pkg = await getPackageById(params.id);
  if (!pkg) return notFound();

  let services: Service[] = [];

  if (pkg.services?.length) {
    const fetched = await Promise.all(pkg.services.map((id) => getServiceById(id)));
    services = fetched.filter(Boolean) as Service[];
  }

  if (!services.length) {
    const fallback = await listPackageServices(params.id).catch(() => []);
    if (fallback.length) {
      const enriched = await Promise.all(
        fallback.map(async (service) => (await getServiceById(service.id)) ?? service),
      );
      services = enriched.filter(Boolean) as Service[];
    }
  }

  const hoursFromServices = services.reduce((acc, service) => {
    const hours = Number(service.totalHours ?? 0);
    return acc + (Number.isFinite(hours) ? hours : 0);
  }, 0);

  const { start, end } = choosePlanBounds(pkg, services);
  const planned = plannedCurve(start, end, hoursFromServices > 0 ? hoursFromServices : pkg.totalHours || 1);

  const contributions = services.map((service) => ({
    hours: Number(service.totalHours ?? 0) || 0,
    progress: computeServiceRealized(service),
  }));

  const totalWeight = contributions.reduce((acc, { hours }) => acc + (hours > 0 ? hours : 0), 0);
  const realized = contributions.length
    ? totalWeight > 0
      ? Math.round(
          contributions.reduce((acc, { hours, progress }) => acc + progress * (hours > 0 ? hours : 0), 0) /
            totalWeight,
        )
      : Math.round(contributions.reduce((acc, entry) => acc + entry.progress, 0) / contributions.length)
    : null;

  const assignedCompanies = pkg.assignedCompanies?.filter((item) => item.companyId);
  const serviceCompanyPairs = services.map((service) => {
    const serviceLabel = service.os || service.code || service.id;
    const companyLabel =
      service.assignedTo?.companyName ||
      service.assignedTo?.companyId ||
      service.company ||
      service.empresa ||
      assignedCompanies?.find((item) => item.companyId === service.assignedTo?.companyId)?.companyName ||
      assignedCompanies?.find((item) => item.companyName)?.companyName ||
      "-";
    return { id: service.id, serviceLabel, companyLabel };
  });

  return (
    <div className="container mx-auto space-y-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pacote {pkg.name || pkg.code || pkg.id}</h1>
          <p className="text-sm text-muted-foreground">Resumo do pacote, serviços vinculados e curva S consolidada.</p>
        </div>
        <Link className="btn btn-secondary" href="/pacotes">
          Voltar
        </Link>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
        <div className="space-y-4">
          <div className="card space-y-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Curva S consolidada</h2>
              <span className="text-xs text-muted-foreground">Realizado: {realized ?? 0}%</span>
            </div>
            <div className="h-[360px] min-h-[320px] w-full">
              <SCurve
                planned={planned}
                realizedSeries={buildPackageRealizedSeries(planned, realized ?? 0)}
                realizedPercent={realized ?? 0}
              />
            </div>
          </div>

          <div className="card p-4">
            <h2 className="mb-4 text-lg font-semibold">Serviços e Empresas</h2>
            {serviceCompanyPairs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum serviço vinculado ao pacote.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {serviceCompanyPairs.map((pair) => (
                  <li key={pair.id} className="flex flex-wrap items-center justify-between gap-3 rounded border p-3">
                    <span className="font-medium text-foreground">{pair.serviceLabel}</span>
                    <span className="text-xs text-muted-foreground">{pair.companyLabel || "-"}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Serviços vinculados</h2>
                <p className="text-xs text-muted-foreground">{services.length} serviços associados a este pacote.</p>
              </div>
            </div>
            {services.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum serviço associado ao pacote.</p>
            ) : (
              <div className="space-y-2">
                {services.map((service) => {
                  const progress = computeServiceRealized(service);
                  return (
                    <Link
                      key={service.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 transition hover:border-primary/40 hover:bg-muted/40"
                      href={`/servicos/${service.id}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{service.os || service.code || service.id}</p>
                        <p className="text-xs text-muted-foreground">
                          {normaliseStatus(service.status)}
                          {service.assignedTo?.companyName || service.assignedTo?.companyId
                            ? ` • ${service.assignedTo.companyName || service.assignedTo.companyId}`
                            : ""}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-primary">{progress}%</span>
                    </Link>
                  );
                })}
              </div>
            )}
            {realized === null && services.length > 0 ? (
              <p className="mt-4 text-xs text-muted-foreground">Sem dados suficientes para calcular o realizado consolidado.</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-4">
            <h2 className="mb-4 text-lg font-semibold">Informações do pacote</h2>
            <dl className="grid grid-cols-1 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="font-medium">{normaliseStatus(pkg.status)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Código</dt>
                <dd className="font-medium">{pkg.code || "-"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Início planejado</dt>
                <dd className="font-medium">{formatDate(pkg.plannedStart)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Fim planejado</dt>
                <dd className="font-medium">{formatDate(pkg.plannedEnd)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Horas totais (serviços)</dt>
                <dd className="font-medium">{hoursFromServices || pkg.totalHours || "-"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Empresas atribuídas</dt>
                <dd className="font-medium">
                  {assignedCompanies && assignedCompanies.length
                    ? assignedCompanies.map((item) => item.companyName || item.companyId).join(", ")
                    : "-"}
                </dd>
              </div>
            </dl>
          </div>

          <PackageTokenManager packageId={pkg.id} companies={assignedCompanies} />
        </div>
      </div>
    </div>
  );
}
