import Link from "next/link";
import * as Navigation from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect";
import DeletePackageButton from "@/components/DeletePackageButton.dynamic";
import SCurveDeferred from "@/components/SCurveDeferred";
import { plannedCurve } from "@/lib/curve";
import { decodeRouteParam } from "@/lib/decodeRouteParam";
import { getPackageByIdCached, listPackageServices } from "@/lib/repo/packages";
import { listPackageFolders } from "@/lib/repo/folders";
import { getServicesByIds, listAvailableOpenServices } from "@/lib/repo/services";
import { formatDate as formatDisplayDate } from "@/lib/formatDateTime";
import type { Package, PackageFolder, Service } from "@/types";

import type { ServiceInfo as FolderServiceInfo, ServiceOption as FolderServiceOption } from "./PackageFoldersManager";
import ServicesCompaniesSection from "./ServicesCompaniesSection";
import PackageFoldersManagerClient from "./PackageFoldersManager.client";

const { notFound } = Navigation;

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_SERVICES_TO_LOAD = 400;

const PACKAGE_STATUS_TONE: Record<string, string> = {
  Concluído: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Encerrado: "bg-slate-200 text-slate-700 border-slate-300",
  Aberto: "bg-sky-100 text-sky-700 border-sky-200",
};

function renderPackageLoadFailure(packageLabel: string, warnings: string[] = []) {
  const uniqueWarnings = Array.from(
    new Set(warnings.filter((message) => typeof message === "string" && message.trim().length > 0)),
  );

  return (
    <div className="container mx-auto max-w-4xl space-y-6 px-4 py-6">
      <div className="rounded-2xl border bg-card/80 p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pacote {packageLabel}</h1>
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar as informações deste pacote no momento.
          </p>
        </div>
        {uniqueWarnings.length ? (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {uniqueWarnings.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        ) : null}
        <Link className="btn btn-secondary mt-4 w-fit" href="/pacotes">
          Voltar
        </Link>
      </div>
    </div>
  );
}

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
  return formatDisplayDate(date, { timeZone: "America/Sao_Paulo", fallback: "-" }) || "-";
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

async function renderPackageDetailPage(params: { id: string }) {
  const rawPackageId = params.id;
  const decodedPackageId = decodeRouteParam(rawPackageId);
  const packageIdCandidates = Array.from(
    new Set([decodedPackageId, rawPackageId].filter((value) => typeof value === "string" && value.length > 0)),
  );
  if (packageIdCandidates.length === 0) {
    return notFound();
  }
  const warningSet = new Set<string>();
  const registerWarning = (message: string, error?: unknown, context?: string) => {
    if (error) {
      console.error(`[PackageDetailPage:${rawPackageId}] ${context ?? message}`, error);
    }
    warningSet.add(message);
  };

  let pkg: Package | null = null;
  let resolvedPackageId = packageIdCandidates[0];

  for (const candidate of packageIdCandidates) {
    try {
      const result = await getPackageByIdCached(candidate);
      if (result) {
        pkg = result;
        resolvedPackageId = result.id ?? candidate;
        break;
      }
    } catch (error) {
      registerWarning(
        "Não foi possível carregar as informações do pacote. Verifique a configuração do Firebase ou tente novamente.",
        error,
        `Falha ao buscar pacote ${candidate}`,
      );
    }
  }

  const displayPackageId =
    pkg?.id ?? (decodedPackageId && decodedPackageId.length > 0 ? decodedPackageId : rawPackageId);

  if (!pkg) {
    const fallbackWarnings = Array.from(warningSet);
    if (fallbackWarnings.length === 0) {
      return notFound();
    }

    return renderPackageLoadFailure(displayPackageId, fallbackWarnings);
  }

  let services: Service[] = [];
  let hasServiceOverflow = false;

  const declaredServiceRefs = (() => {
    if (Array.isArray(pkg.serviceIds) && pkg.serviceIds.length) {
      return pkg.serviceIds;
    }
    if (Array.isArray(pkg.services) && pkg.services.length) {
      return pkg.services;
    }
    return [];
  })();

  const uniqueServiceIds = Array.from(
    new Set(
      declaredServiceRefs
        .map((value) => {
          if (typeof value === "string") return value.trim();
          if (typeof value === "number" && Number.isFinite(value)) return String(value);
          return "";
        })
        .filter((value) => value.length > 0),
    ),
  );

  const serviceIdsToFetch = uniqueServiceIds.slice(0, MAX_SERVICES_TO_LOAD);
  if (uniqueServiceIds.length > serviceIdsToFetch.length) {
    hasServiceOverflow = true;
  }

  if (serviceIdsToFetch.length) {
    try {
      const fetched = await getServicesByIds(serviceIdsToFetch, { mode: "summary" });
      services = fetched;
      const fetchedIds = new Set(fetched.map((service) => service.id));
      const missing = serviceIdsToFetch.filter((id) => !fetchedIds.has(id));
      if (missing.length) {
        registerWarning(
          "Alguns serviços vinculados ao pacote não puderam ser carregados completamente.",
          undefined,
          missing.join(", "),
        );
      }
    } catch (error) {
      registerWarning(
        "Não foi possível carregar os serviços vinculados ao pacote.",
        error,
        "Falha ao buscar serviços do pacote",
      );
    }
  }

  let serviceCountReference = uniqueServiceIds.length;
  let serviceCountIsExact = uniqueServiceIds.length > 0;

  if (!services.length) {
    try {
      const fallbackLimit = MAX_SERVICES_TO_LOAD + 1;
      const fallback = await listPackageServices(resolvedPackageId, { limit: fallbackLimit });
      if (fallback.length) {
        if (fallback.length > MAX_SERVICES_TO_LOAD) {
          hasServiceOverflow = true;
          if (serviceCountReference === 0) {
            serviceCountIsExact = false;
            serviceCountReference = MAX_SERVICES_TO_LOAD + 1;
          }
        } else if (serviceCountReference === 0) {
          serviceCountReference = fallback.length;
          serviceCountIsExact = fallback.length < fallbackLimit;
        }

        const fallbackSlice = fallback.slice(0, MAX_SERVICES_TO_LOAD);

        let enriched: Service[] = [];
        try {
          enriched = await getServicesByIds(fallbackSlice.map((service) => service.id), { mode: "summary" });
        } catch (error) {
          registerWarning(
            "Alguns serviços foram carregados parcialmente.",
            error,
            "Falha ao detalhar serviços do pacote",
          );
        }
        if (enriched.length) {
          const byId = new Map(enriched.map((service) => [service.id, service]));
          services = fallbackSlice.map((service) => byId.get(service.id) ?? service);
        } else {
          services = fallbackSlice;
        }
      }
    } catch (error) {
      registerWarning(
        "Não foi possível carregar os serviços vinculados ao pacote.",
        error,
        "Falha ao listar serviços do pacote",
      );
    }
  }

  if (hasServiceOverflow && services.length) {
    const displayedCount = services.length;
    const totalLabel = serviceCountIsExact
      ? `${serviceCountReference} serviço${serviceCountReference === 1 ? "" : "s"}`
      : `mais de ${Math.max(displayedCount, MAX_SERVICES_TO_LOAD)} serviço${
          Math.max(displayedCount, MAX_SERVICES_TO_LOAD) === 1 ? "" : "s"
        }`;
    registerWarning(
      `Este pacote possui ${totalLabel} vinculados. Exibimos apenas ${displayedCount} serviço${
        displayedCount === 1 ? "" : "s"
      } para evitar travamentos. Os dados agregados podem ficar incompletos.`,
    );
  } else if (hasServiceOverflow && services.length === 0) {
    registerWarning(
      "Este pacote possui muitos serviços vinculados. Os detalhes completos não puderam ser exibidos.",
    );
  }

  const hoursFromServices = services.reduce((acc, service) => {
    const hours = Number(service.totalHours ?? 0);
    return acc + (Number.isFinite(hours) ? hours : 0);
  }, 0);

  const { start, end } = choosePlanBounds(pkg, services);
  const totalHoursCandidate = (() => {
    if (!hasServiceOverflow && hoursFromServices > 0) {
      return hoursFromServices;
    }
    if (Number.isFinite(pkg.totalHours) && Number(pkg.totalHours) > 0) {
      return Number(pkg.totalHours);
    }
    if (hoursFromServices > 0) {
      return hoursFromServices;
    }
    return 1;
  })();
  const planned = plannedCurve(start, end, totalHoursCandidate);

  const contributions = services.map((service) => ({
    hours: Number(service.totalHours ?? 0) || 0,
    progress: computeServiceRealized(service),
  }));

  const totalWeight = contributions.reduce((acc, { hours }) => acc + (hours > 0 ? hours : 0), 0);
  const realized =
    contributions.length && !hasServiceOverflow
      ? totalWeight > 0
        ? Math.round(
            contributions.reduce((acc, { hours, progress }) => acc + progress * (hours > 0 ? hours : 0), 0) /
              totalWeight,
          )
        : Math.round(contributions.reduce((acc, entry) => acc + entry.progress, 0) / contributions.length)
      : null;
  const realizedSeriesData = hasServiceOverflow ? [] : buildPackageRealizedSeries(planned, realized ?? 0);
  const realizedValueLabel = typeof realized === "number" ? `${realized}%` : "-";
  const realizedHeaderLabel = hasServiceOverflow
    ? `Realizado (parcial): ${realizedValueLabel}`
    : `Realizado: ${realizadoValueLabel}`;

  const assignedCompanies = pkg.assignedCompanies?.filter((item) => item.companyId);
  let folders: PackageFolder[] = [];
  let availableOpenServices: Service[] = [];

  const [foldersResult, availableServicesResult] = await Promise.allSettled([
    listPackageFolders(pkg.id),
    listAvailableOpenServices(200, { mode: "summary" }),
  ]);

  if (foldersResult.status === "fulfilled") {
    folders = foldersResult.value;
  } else {
    registerWarning(
      "Não foi possível carregar os subpacotes vinculados a este pacote.",
      foldersResult.reason,
      "Falha ao listar subpacotes do pacote",
    );
  }

  if (availableServicesResult.status === "fulfilled") {
    availableOpenServices = availableServicesResult.value;
  } else {
    registerWarning(
      "Não foi possível carregar os serviços abertos disponíveis para novos subpacotes.",
      availableServicesResult.reason,
      "Falha ao listar serviços disponíveis",
    );
  }

  const folderServiceIds = new Set<string>();
  folders.forEach((folder) => {
    folder.services.forEach((serviceId) => {
      if (!serviceId) return;
      folderServiceIds.add(serviceId);
    });
  });

  const availableServiceOptions: FolderServiceOption[] = availableOpenServices
    .filter((service) => !folderServiceIds.has(service.id))
    .map((service) => {
      const baseLabel = service.os || service.oc || service.tag || service.id;
      const descriptionParts: string[] = [];
      const companyLabel = service.empresa || service.company || service.assignedTo?.companyName;
      if (companyLabel) descriptionParts.push(`Empresa: ${companyLabel}`);
      if (service.setor) descriptionParts.push(`Setor: ${service.setor}`);
      return {
        id: service.id,
        label: baseLabel && baseLabel.length ? baseLabel : service.id,
        description: descriptionParts.length ? descriptionParts.join(" • ") : undefined,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" }));

  const serviceDetails: Record<string, FolderServiceInfo> = {};

  services.forEach((service) => {
    const baseLabel = service.os || service.code || service.id;
    const companyLabel =
      service.assignedTo?.companyName ||
      service.assignedTo?.companyId ||
      service.company ||
      service.empresa ||
      assignedCompanies?.find((item) => item.companyId === service.assignedTo?.companyId)?.companyName ||
      assignedCompanies?.find((item) => item.companyName)?.companyName ||
      undefined;
    const statusLabel = normaliseStatus(service.status);
    serviceDetails[service.id] = {
      id: service.id,
      label: companyLabel ? `${baseLabel} — ${companyLabel}` : baseLabel,
      status: statusLabel,
      companyLabel: companyLabel,
      isOpen: statusLabel === "Aberto",
    };
  });

  availableOpenServices.forEach((service) => {
    const companyLabel =
      service.empresa || service.company || service.assignedTo?.companyName || service.assignedTo?.companyId || null;
    if (serviceDetails[service.id]) {
      if (!serviceDetails[service.id].companyLabel && companyLabel) {
        serviceDetails[service.id] = {
          ...serviceDetails[service.id],
          companyLabel: companyLabel ?? undefined,
        };
      }
      return;
    }
    const baseLabel = service.os || service.oc || service.tag || service.id;
    serviceDetails[service.id] = {
      id: service.id,
      label: companyLabel ? `${baseLabel} — ${companyLabel}` : baseLabel,
      status: service.status ?? "Aberto",
      companyLabel: companyLabel ?? undefined,
      isOpen: true,
    };
  });

  folders.forEach((folder) => {
    folder.services.forEach((serviceId) => {
      if (!serviceId || serviceDetails[serviceId]) return;
      serviceDetails[serviceId] = {
        id: serviceId,
        label: serviceId,
        status: "Desconhecido",
        companyLabel: folder.companyId ?? undefined,
        isOpen: false,
      };
    });
  });

  const warningMessages = Array.from(warningSet);
  const encodedPackageId = encodeURIComponent(pkg.id);
  const packageLabel = pkg.name || pkg.code || pkg.id;
  const statusLabel = normaliseStatus(pkg.status);
  const statusTone = PACKAGE_STATUS_TONE[statusLabel] ?? "border-border bg-muted text-foreground/80";
  const plannedStartLabel = formatDate(pkg.plannedStart);
  const plannedEndLabel = formatDate(pkg.plannedEnd);
  const totalHoursLabel = hasServiceOverflow
    ? pkg.totalHours || hoursFromServices || "-"
    : hoursFromServices || pkg.totalHours || "-";
  const totalServicesLabel = serviceCountReference
    ? serviceCountIsExact
      ? `${serviceCountReference} serviço${serviceCountReference === 1 ? "" : "s"}`
      : `Mais de ${Math.max(serviceCountReference, services.length)} serviços`
    : `${services.length} serviço${services.length === 1 ? "" : "s"}`;

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-6">
      <section className="rounded-2xl border bg-card/80 p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusTone}`}>
                {statusLabel}
              </span>
              <span className="rounded-full border border-transparent bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground">
                {realizedHeaderLabel}
              </span>
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">Pacote {packageLabel}</h1>
              <p className="text-sm text-muted-foreground">
                Resumo do pacote, serviços vinculados e curva S consolidada.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <Link className="btn btn-secondary" href="/pacotes">
              Voltar
            </Link>
            <Link className="btn btn-primary" href={`/pacotes/${encodedPackageId}/editar`}>
              Editar
            </Link>
            <DeletePackageButton packageId={pkg.id} packageLabel={packageLabel} />
          </div>
        </div>

        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1 rounded-xl border border-dashed border-border/70 bg-muted/20 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Início planejado</dt>
            <dd className="text-base font-semibold text-foreground">{plannedStartLabel}</dd>
          </div>
          <div className="space-y-1 rounded-xl border border-dashed border-border/70 bg-muted/20 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fim planejado</dt>
            <dd className="text-base font-semibold text-foreground">{plannedEndLabel}</dd>
          </div>
          <div className="space-y-1 rounded-xl border border-dashed border-border/70 bg-muted/20 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Serviços vinculados</dt>
            <dd className="text-base font-semibold text-foreground">{totalServicesLabel}</dd>
          </div>
          <div className="space-y-1 rounded-xl border border-dashed border-border/70 bg-muted/20 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Horas totais</dt>
            <dd className="text-base font-semibold text-foreground">{totalHoursLabel}</dd>
          </div>
        </dl>
      </section>

      {warningMessages.length ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-900 shadow-sm">
          <p className="font-medium">Nem todas as informações foram carregadas.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {warningMessages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
        <section className="rounded-2xl border bg-card/80 p-5 shadow-sm">
          <SCurveDeferred
            planned={planned}
            realizedSeries={realizedSeriesData}
            realizedPercent={typeof realized === "number" ? realized : 0}
            title="Curva S consolidada"
            description="Planejado versus realizado considerando todos os serviços do pacote."
            headerAside={<span className="font-medium text-foreground">{realizedHeaderLabel}</span>}
            chartHeight={360}
            deferRendering
            fallback={
              <div className="flex h-[360px] w-full items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/40">
                <span className="text-sm text-muted-foreground">Carregando gráfico...</span>
              </div>
            }
          />
        </section>

        <section className="rounded-2xl border bg-card/80 p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Informações do pacote</h2>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div className="space-y-1">
              <dt className="text-muted-foreground">Status</dt>
              <dd className="font-medium">{statusLabel}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-muted-foreground">Código</dt>
              <dd className="font-medium">{pkg.code || "-"}</dd>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <dt className="text-muted-foreground">Descrição</dt>
              <dd className="whitespace-pre-wrap text-sm text-foreground/90">
                {pkg.description && pkg.description.trim() ? pkg.description : "-"}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-muted-foreground">Início planejado</dt>
              <dd className="font-medium">{plannedStartLabel}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-muted-foreground">Fim planejado</dt>
              <dd className="font-medium">{plannedEndLabel}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-muted-foreground">Horas totais (serviços)</dt>
              <dd className="font-medium">{totalHoursLabel}</dd>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <dt className="text-muted-foreground">Empresas atribuídas</dt>
              <dd className="font-medium">
                {assignedCompanies && assignedCompanies.length
                  ? assignedCompanies.map((item) => item.companyName || item.companyId).join(", ")
                  : "-"}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <div className="space-y-6">
        <PackageFoldersManagerClient
          packageId={pkg.id}
          services={availableServiceOptions}
          serviceDetails={serviceDetails}
          initialFolders={folders}
        />

        <ServicesCompaniesSection folders={folders} serviceDetails={serviceDetails} />
      </div>
    </div>
  );
}

function isRedirectDigestError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const possible = error as { digest?: unknown };
  return typeof possible.digest === "string" && possible.digest.startsWith("NEXT_REDIRECT");
}

function isNotFoundLikeError(error: unknown): boolean {
  if (typeof (Navigation as { isNotFoundError?: unknown }).isNotFoundError === "function") {
    if ((Navigation as { isNotFoundError: (error: unknown) => boolean }).isNotFoundError(error)) {
      return true;
    }
  }

  if (!error || typeof error !== "object") return false;
  const digest = (error as { digest?: unknown }).digest;
  if (typeof digest === "string") {
    return digest === "NEXT_NOT_FOUND" || digest.startsWith("NEXT_NOT_FOUND");
  }
  return false;
}

export default async function PackageDetailPage({ params }: { params: { id: string } }) {
  try {
    return await renderPackageDetailPage(params);
  } catch (error) {
    if (isNotFoundLikeError(error) || isRedirectDigestError(error)) {
      throw error;
    }

    const rawPackageId = params?.id ?? "";
    const decodedPackageId = decodeRouteParam(rawPackageId);
    const displayPackageId = decodedPackageId && decodedPackageId.length > 0 ? decodedPackageId : rawPackageId || "-";

    console.error(
      `[PackageDetailPage:${rawPackageId || "unknown"}] Erro inesperado ao renderizar os detalhes do pacote.`,
      error,
    );

    return renderPackageLoadFailure(displayPackageId, [
      "Ocorreu um erro inesperado ao carregar os detalhes do pacote.",
      "Verifique as credenciais do Firebase e tente novamente.",
    ]);
  }
}
