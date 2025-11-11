export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { notFound } from "next/navigation";

import SCurve from "@/components/SCurve";
import { plannedCurve } from "@/lib/curve";
import { getPackageById, listPackageServices } from "@/lib/repo/packages";
import { listPackageFolders } from "@/lib/repo/folders";
import { getServiceById } from "@/lib/repo/services";
import type { Package, PackageFolder, Service } from "@/types";

import PackageFoldersManager from "./PackageFoldersManager";

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
  const startCandidates = [pkg.plannedStart, ...services.map((service) => service.plannedStart)]
    .map(parseISO)
    .filter(Boolean) as Date[];
  const endCandidates = [pkg.plannedEnd, ...services.map((service) => service.plannedEnd)]
    .map(parseISO)
    .filter(Boolean) as Date[];
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
  const warningSet = new Set<string>();
  const registerWarning = (message: string, error?: unknown, context?: string) => {
    if (error) {
      console.error(`[PackageDetailPage:${params.id}] ${context ?? message}`, error);
    }
    warningSet.add(message);
  };

  let pkg: Package | null = null;

  try {
    pkg = await getPackageById(params.id);
  } catch (error) {
    registerWarning(
      "Não foi possível carregar as informações do pacote. Verifique a configuração do Firebase ou tente novamente.",
      error,
      "Falha ao buscar pacote",
    );
  }

  if (!pkg) {
    const fallbackWarnings = Array.from(warningSet);
    if (fallbackWarnings.length === 0) {
      return notFound();
    }

    return (
      <div className="container mx-auto space-y-6 p-4">
        <div className="card mx-auto max-w-2xl space-y-4 p-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Pacote {params.id}</h1>
            <p className="text-sm text-muted-foreground">
              Não foi possível carregar as informações deste pacote no momento.
            </p>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {fallbackWarnings.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
          <Link className="btn btn-secondary w-fit" href="/pacotes">
            Voltar
          </Link>
        </div>
      </div>
    );
  }

  let services: Service[] = [];

  if (pkg.services?.length) {
    const fetched = await Promise.all(
      pkg.services.map((id) =>
        getServiceById(id).catch((error) => {
          registerWarning(
            "Não foi possível carregar alguns serviços vinculados ao pacote.",
            error,
            `Falha ao buscar serviço ${id}`,
          );
          return null;
        }),
      ),
    );
    services = fetched.filter(Boolean) as Service[];
  }

  if (!services.length) {
    try {
      const fallback = await listPackageServices(params.id);
      if (fallback.length) {
        const enriched = await Promise.all(
          fallback.map((service) =>
            getServiceById(service.id).catch((error) => {
              registerWarning(
                "Alguns serviços foram carregados parcialmente.",
                error,
                `Falha ao detalhar serviço ${service.id}`,
              );
              return service;
            }),
          ),
        );
        services = enriched.filter(Boolean) as Service[];
      }
    } catch (error) {
      registerWarning(
        "Não foi possível carregar os serviços vinculados ao pacote.",
        error,
        "Falha ao listar serviços do pacote",
      );
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
          contributions.reduce((acc, { hours, progress }) => acc + progress * (hours > 0 ? hours : 0), 0) / totalWeight,
        )
      : Math.round(contributions.reduce((acc, entry) => acc + entry.progress, 0) / contributions.length)
    : null;

  const assignedCompanies = pkg.assignedCompanies?.filter((item) => item.companyId);
  let folders: PackageFolder[] = [];

  try {
    folders = await listPackageFolders(pkg.id);
  } catch (error) {
    registerWarning(
      "Não foi possível carregar as pastas vinculadas a este pacote.",
      error,
      "Falha ao listar pastas do pacote",
    );
  }

  const serviceFoldersMap = new Map<string, string[]>();
  folders.forEach((folder) => {
    folder.services.forEach((serviceId) => {
      if (!serviceId) return;
      const list = serviceFoldersMap.get(serviceId) ?? [];
      list.push(folder.name);
      serviceFoldersMap.set(serviceId, list);
    });
  });

  const folderServiceOptions = services.map((service) => {
    const baseLabel = service.os || service.code || service.id;
    const companyLabel =
      service.assignedTo?.companyName ||
      service.assignedTo?.companyId ||
      service.company ||
      service.empresa ||
      "";
    return { id: service.id, label: companyLabel ? `${baseLabel} — ${companyLabel}` : baseLabel };
  });

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
    const foldersForService = serviceFoldersMap.get(service.id) ?? [];
    return { id: service.id, serviceLabel, companyLabel, folders: foldersForService };
  });

  const warningMessages = Array.from(warningSet);

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

      {warningMessages.length ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">Nem todas as informações foram carregadas.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {warningMessages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
        <div className="space-y-4">
          <SCurve
            planned={planned}
            realizedSeries={buildPackageRealizedSeries(planned, realized ?? 0)}
            realizedPercent={realized ?? 0}
            title="Curva S consolidada"
            description="Planejado versus realizado considerando todos os serviços do pacote."
            headerAside={<span className="font-medium text-foreground">Realizado: {realized ?? 0}%</span>}
            chartHeight={360}
          />

          <div className="card p-4">
            <h2 className="mb-4 text-lg font-semibold">Serviços e Empresas</h2>
            {serviceCompanyPairs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum serviço vinculado ao pacote.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {serviceCompanyPairs.map((pair) => (
                  <li key={pair.id} className="flex flex-wrap items-center justify-between gap-3 rounded border p-3">
                    <span className="font-medium text-foreground">{pair.serviceLabel}</span>
                    <span className="text-xs text-muted-foreground">
                      {pair.companyLabel || "-"}
                      {pair.folders.length ? ` • ${pair.folders.join(", ")}` : ""}
                    </span>
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
                  const foldersForService = serviceFoldersMap.get(service.id) ?? [];
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
                          {foldersForService.length ? ` • Pastas: ${foldersForService.join(", ")}` : ""}
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

          <PackageFoldersManager
            packageId={pkg.id}
            services={folderServiceOptions}
            initialFolders={folders}
          />
        </div>
      </div>
    </div>
  );
}
