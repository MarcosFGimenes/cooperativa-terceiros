import Link from "next/link";
import * as Navigation from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect";
import DeletePackageButton from "@/components/DeletePackageButton.dynamic";
import SCurveDeferred from "@/components/SCurveDeferred";
import { decodeRouteParam } from "@/lib/decodeRouteParam";
import { getPackageByIdCached, listPackageServices } from "@/lib/repo/packages";
import { listPackageFolders } from "@/lib/repo/folders";
import { getServicesByIds, listAvailableOpenServices } from "@/lib/repo/services";
import { formatDate as formatDisplayDate } from "@/lib/formatDateTime";
import {
  calcularCurvaSPlanejada,
  calcularCurvaSRealizada,
  calcularIndicadoresCurvaS,
  calcularMetricasPorSetor,
  calcularMetricasSubpacote,
  calcularPercentualPlanejadoPacote,
  calcularPercentualPlanejadoServico,
  calcularPercentualRealizadoPacote,
  calcularPercentualSubpacote,
  calcularPercentualRealizadoSubpacote,
  obterIntervaloSubpacote,
  toDate,
  type ServicoDoSubpacote,
} from "@/lib/serviceProgress";
import type { Package, PackageFolder, Service } from "@/types";
import { formatReferenceLabel, resolveReferenceDate } from "@/lib/referenceDate";

import type { ServiceInfo as FolderServiceInfo, ServiceOption as FolderServiceOption } from "./PackageFoldersManager";
import ServicesCompaniesSection from "./ServicesCompaniesSection";
import PackageFoldersManagerClient from "./PackageFoldersManager.client";
import PackagePdfExportButton from "./PackagePdfExportButton";
import ReferenceDateSelector from "@/components/ReferenceDateSelector";

const { notFound } = Navigation;

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_SERVICES_TO_LOAD = 400;

type PackageFolderWithProgress = PackageFolder & {
  progressPercent?: number | null;
  realizedPercent?: number | null;
  startDateMs?: number | null;
  endDateMs?: number | null;
};

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
          <h1 className="text-2xl font-semibold tracking-tight">{packageLabel}</h1>
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
  if (raw === "pendente") return "Pendente";
  return "Aberto";
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

function mapServiceToSubpackageEntry(service: Service): ServicoDoSubpacote {
  const updates = service.updates ?? [];
  const label = service.os || service.code || service.id;
  const dataInicio =
    service.dataInicio ??
    service.inicioPrevisto ??
    service.inicioPlanejado ??
    service.plannedStart ??
    service.startDate ??
    null;
  const dataFim =
    service.dataFim ??
    service.fimPrevisto ??
    service.fimPlanejado ??
    service.plannedEnd ??
    service.endDate ??
    null;
  const horasPrevistas =
    service.totalHours ??
    service.horasPrevistas ??
    service.horas ??
    service.hours ??
    service.peso ??
    service.weight ??
    null;
  const entry: ServicoDoSubpacote = {
    id: service.id,
    nome: label,
    horasPrevistas,
    totalHours: service.totalHours,
    horas: service.horas,
    hours: service.hours,
    peso: service.peso,
    weight: service.weight,
    dataInicio,
    inicioPrevisto: service.inicioPrevisto,
    inicioPlanejado: service.inicioPlanejado,
    plannedStart: service.plannedStart ?? dataInicio ?? undefined,
    startDate: service.startDate ?? dataInicio ?? undefined,
    dataFim,
    fimPrevisto: service.fimPrevisto,
    fimPlanejado: service.fimPlanejado,
    plannedEnd: service.plannedEnd ?? dataFim ?? undefined,
    endDate: service.endDate ?? dataFim ?? undefined,
    percentualRealAtual: service.progress ?? service.realPercent ?? service.andamento ?? null,
    updates,
    atualizacoes: updates,
  };

  const updateListKeys = [
    "atualizacoes",
    "historicoAtualizacoes",
    "historico",
    "history",
    "updates",
    "progressUpdates",
    "percentualUpdates",
    "realUpdates",
  ] as const;
  updateListKeys.forEach((key) => {
    const value = (service as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      (entry as Record<string, unknown>)[key] = value;
    }
  });

  const updateDateKeys = [
    "dataUltimaAtualizacao",
    "dataAtualizacao",
    "dataAtualizacaoPercentual",
    "atualizadoEm",
    "lastUpdateDate",
    "updatedAt",
  ] as const;
  updateDateKeys.forEach((key) => {
    if (Object.hasOwn(service as Record<string, unknown>, key)) {
      (entry as Record<string, unknown>)[key] = (service as Record<string, unknown>)[key];
    }
  });

  return entry;
}

function clampPercent(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, value));
}

function parsePercent(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return clampPercent(value);
  }
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", ".").trim());
    if (Number.isFinite(parsed)) return clampPercent(parsed);
  }
  return null;
}

function extractDateMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.getTime();
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) return parsed.getTime();
  }
  return null;
}

function buildServiceProgressSnapshot(service: Service, dataReferencia?: Parameters<typeof toDate>[0]) {
  const reference = toDate(dataReferencia ?? new Date()) ?? new Date();
  const plannedPercent =
    calcularPercentualPlanejadoServico(mapServiceToSubpackageEntry(service), reference) ?? 0;
  const percentCandidates: unknown[] = [
    service.realPercent,
    service.progress,
    service.andamento,
    (service as Record<string, unknown>).percentual,
    (service as Record<string, unknown>).percent,
    (service as Record<string, unknown>).pct,
    (service as Record<string, unknown>).percentualRealAtual,
  ];
  const realizedPercent = clampPercent(percentCandidates.map((candidate) => parsePercent(candidate)).find((value) => value !== null)) ?? 0;
  const deltaPercent = Number.isFinite(realizedPercent - plannedPercent) ? realizedPercent - plannedPercent : null;
  const startDateMs =
    extractDateMs(service.dataInicio) ??
    extractDateMs(service.inicioPrevisto) ??
    extractDateMs(service.inicioPlanejado) ??
    extractDateMs(service.plannedStart) ??
    extractDateMs(service.startDate);
  const endDateMs =
    extractDateMs(service.dataFim) ??
    extractDateMs(service.fimPrevisto) ??
    extractDateMs(service.fimPlanejado) ??
    extractDateMs(service.plannedEnd) ??
    extractDateMs(service.endDate);

  return { plannedPercent, realizedPercent, deltaPercent, startDateMs, endDateMs };
}

async function renderPackageDetailPage(
  params: { id: string },
  searchParams?: Record<string, string | string[] | undefined>,
) {
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

  const refDateParam = searchParams?.refDate;
  const refDateValue = Array.isArray(refDateParam) ? refDateParam[0] : refDateParam ?? null;
  const { date: referenceDate, inputValue: referenceDateInput } = resolveReferenceDate(refDateValue);
  const referenceLabel = formatReferenceLabel(referenceDate);

  const refDateParam = searchParams?.refDate;
  const refDateValue = Array.isArray(refDateParam) ? refDateParam[0] : refDateParam ?? null;
  const { date: referenceDate, inputValue: referenceDateInput } = resolveReferenceDate(refDateValue);
  const referenceLabel = formatReferenceLabel(referenceDate);

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
      const fetched = await getServicesByIds(serviceIdsToFetch, { mode: "full" });
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
          enriched = await getServicesByIds(fallbackSlice.map((service) => service.id), { mode: "full" });
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

  const assignedCompanies = pkg.assignedCompanies?.filter((item) => item.companyId);
  let folders: PackageFolderWithProgress[] = [];
  let availableOpenServices: Service[] = [];

  const [foldersResult, availableServicesResult] = await Promise.allSettled([
    listPackageFolders(pkg.id),
    listAvailableOpenServices(200, { mode: "summary", disableCache: true }),
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

  const servicesById = new Map(services.map((service) => [service.id, service]));
  const subpackagesForCurve = folders.map((folder) => {
    const servicos = folder.services
      .map((serviceId) => servicesById.get(serviceId))
      .filter((service): service is Service => Boolean(service))
      .map((service) => mapServiceToSubpackageEntry(service));
    return { id: folder.id, nome: folder.name, servicos };
  });

  const packageForCurve = { subpacotes: subpackagesForCurve };
  const plannedCurvePoints = calcularCurvaSPlanejada(packageForCurve, referenceDate).map((point) => ({
    date: point.data.toISOString().slice(0, 10),
    percent: point.percentual,
  }));
  const realizedSeriesData = calcularCurvaSRealizada(packageForCurve, referenceDate).map((point) => ({
    date: point.data.toISOString().slice(0, 10),
    percent: point.percentual,
  }));
  const curvaIndicators = calcularIndicadoresCurvaS(packageForCurve, referenceDate);
  const plannedPercentAtReference = Math.round(
    calcularPercentualPlanejadoPacote(packageForCurve, referenceDate),
  );
  const realizedPercent = Math.round(
    calcularPercentualRealizadoPacote(packageForCurve, referenceDate),
  );
  const realizedValueLabel = `${realizedPercent}%`;
  const realizedHeaderLabel = hasServiceOverflow
    ? `Realizado em ${referenceLabel} (parcial): ${realizedValueLabel}`
    : `Realizado em ${referenceLabel}: ${realizedValueLabel}`;
  const curveMetrics = {
    plannedTotal: curvaIndicators.planejadoTotal,
    plannedToDate: curvaIndicators.planejadoAteHoje,
    realized: curvaIndicators.realizado,
    delta: curvaIndicators.diferenca,
  };

  const folderAnalyticsMap = new Map<
    string,
    { plannedPercent: number; realizedPercent: number; startDateMs: number | null; endDateMs: number | null }
  >();
  subpackagesForCurve.forEach((subpacote) => {
    if (!subpacote?.id) return;
    const plannedPercentRaw = calcularPercentualSubpacote(subpacote, referenceDate);
    const realizedPercentRaw = calcularPercentualRealizadoSubpacote(subpacote, referenceDate);
    const plannedPercent = Math.round(plannedPercentRaw);
    const realizedPercent = Math.round(realizedPercentRaw);
    const intervalo = obterIntervaloSubpacote(subpacote);
    folderAnalyticsMap.set(subpacote.id, {
      plannedPercent,
      realizedPercent,
      startDateMs: intervalo.inicio ? intervalo.inicio.getTime() : null,
      endDateMs: intervalo.fim ? intervalo.fim.getTime() : null,
    });
  });
  folders = folders.map((folder) => {
    const analytics = folderAnalyticsMap.get(folder.id);
    return {
      ...folder,
      progressPercent: analytics?.plannedPercent ?? 0,
      realizedPercent: analytics?.realizedPercent ?? null,
      startDateMs: analytics?.startDateMs ?? null,
      endDateMs: analytics?.endDateMs ?? null,
    };
  });

  const folderServiceIds = new Set<string>();
  folders.forEach((folder) => {
    folder.services.forEach((serviceId) => {
      if (!serviceId) return;
      folderServiceIds.add(serviceId);
    });
  });

  const folderLookup = new Map<string, { id: string; name?: string | null }>();
  folders.forEach((folder) => {
    folder.services.forEach((serviceId) => {
      if (!serviceId) return;
      folderLookup.set(serviceId, { id: folder.id, name: folder.name });
    });
  });

  const servicesWithFolderContext = services.map((service) => {
    const folderData = folderLookup.get(service.id);
    const directFolderId =
      (typeof (service as { folderId?: unknown }).folderId === "string" &&
        (service as { folderId?: string }).folderId.trim()) ||
      (typeof (service as { pastaId?: unknown }).pastaId === "string" &&
        (service as { pastaId?: string }).pastaId.trim()) ||
      null;

    return {
      ...service,
      folderId: folderData?.id ?? directFolderId,
      pastaId: directFolderId ?? (service as { pastaId?: string | null }).pastaId,
      folderName: folderData?.name ?? null,
    };
  });

  const subpackageMetrics = calcularMetricasSubpacote(servicesWithFolderContext, referenceDate);
  const sectorMetrics = calcularMetricasPorSetor(servicesWithFolderContext, referenceDate);

  const formatMetricValue = (value: number): string => {
    const rounded = Math.round(value);
    if (!Number.isFinite(rounded)) return "0";
    return Object.is(rounded, -0) ? "0" : String(rounded);
  };

  const availableServiceOptions: FolderServiceOption[] = availableOpenServices
    .filter((service) => !folderServiceIds.has(service.id))
    .map((service) => {
      const baseLabel = service.os || service.oc || service.tag || service.id;
      const descriptionParts: string[] = [];
      const companyLabel = service.empresa || service.company || service.assignedTo?.companyName;
      if (companyLabel) descriptionParts.push(`Empresa: ${companyLabel}`);
      if (service.setor) descriptionParts.push(`Setor: ${service.setor}`);
      const statusLabel = normaliseStatus(service.status);
      return {
        id: service.id,
        label: baseLabel && baseLabel.length ? baseLabel : service.id,
        description: descriptionParts.length ? descriptionParts.join(" • ") : undefined,
        status: statusLabel,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" }));

  const serviceDetails: Record<string, FolderServiceInfo> = {};

  services.forEach((service) => {
    const baseLabel = service.os || service.code || service.id;
    const snapshot = buildServiceProgressSnapshot(service, referenceDate);
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
      plannedPercent: snapshot.plannedPercent,
      realizedPercent: snapshot.realizedPercent,
      deltaPercent: snapshot.deltaPercent,
      startDateMs: snapshot.startDateMs,
      endDateMs: snapshot.endDateMs,
      isOpen: statusLabel === "Aberto" || statusLabel === "Pendente",
    };
  });

  availableOpenServices.forEach((service) => {
    const companyLabel =
      service.empresa || service.company || service.assignedTo?.companyName || service.assignedTo?.companyId || null;
    const snapshot = buildServiceProgressSnapshot(service, referenceDate);
    if (serviceDetails[service.id]) {
      if (!serviceDetails[service.id].companyLabel && companyLabel) {
        serviceDetails[service.id] = {
          ...serviceDetails[service.id],
          companyLabel: companyLabel ?? undefined,
          plannedPercent: serviceDetails[service.id].plannedPercent ?? snapshot.plannedPercent,
          realizedPercent: serviceDetails[service.id].realizedPercent ?? snapshot.realizedPercent,
          deltaPercent: serviceDetails[service.id].deltaPercent ?? snapshot.deltaPercent,
          startDateMs: serviceDetails[service.id].startDateMs ?? snapshot.startDateMs,
          endDateMs: serviceDetails[service.id].endDateMs ?? snapshot.endDateMs,
        };
      }
      return;
    }
    const baseLabel = service.os || service.oc || service.tag || service.id;
    const statusLabel = normaliseStatus(service.status);
    serviceDetails[service.id] = {
      id: service.id,
      label: companyLabel ? `${baseLabel} — ${companyLabel}` : baseLabel,
      status: statusLabel,
      companyLabel: companyLabel ?? undefined,
      plannedPercent: snapshot.plannedPercent,
      realizedPercent: snapshot.realizedPercent,
      deltaPercent: snapshot.deltaPercent,
      startDateMs: snapshot.startDateMs,
      endDateMs: snapshot.endDateMs,
      isOpen: statusLabel === "Aberto" || statusLabel === "Pendente",
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
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-6 package-print-layout">
      <section className="rounded-2xl border bg-card/80 p-5 shadow-sm print-card">
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
              <h1 className="text-2xl font-semibold tracking-tight">{packageLabel}</h1>
              <p className="text-sm text-muted-foreground">
                Resumo do pacote, serviços vinculados e curva S consolidada.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:justify-end print:hidden">
            <Link className="btn btn-secondary" href="/pacotes">
              Voltar
            </Link>
            <Link className="btn btn-primary" href={`/pacotes/${encodedPackageId}/editar`}>
              Editar
            </Link>
            <PackagePdfExportButton />
            <DeletePackageButton packageId={pkg.id} packageLabel={packageLabel} />
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Data de referência
              </p>
              <p className="text-base font-semibold text-foreground">{referenceLabel}</p>
              <p className="text-xs text-muted-foreground">
                Planejado: <span className="font-semibold text-foreground">{plannedPercentAtReference}%</span> | Real:
                <span className="font-semibold text-foreground"> {realizedPercent}%</span>
              </p>
            </div>
            <div className="w-full max-w-[240px]">
              <ReferenceDateSelector value={referenceDateInput} />
            </div>
          </div>
        </div>

        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 summary-grid">
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
        <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-900 shadow-sm print:hidden">
          <p className="font-medium">Nem todas as informações foram carregadas.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {warningMessages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
        <section
          className="rounded-2xl border bg-card/80 p-5 shadow-sm scurve-card print-card print-avoid-break"
          style={{ breakInside: "avoid-page", pageBreakInside: "avoid" }}
        >
          <SCurveDeferred
            planned={plannedCurvePoints}
            realizedSeries={realizedSeriesData}
            realizedPercent={realizedPercent}
            title="Curva S consolidada"
            description="Planejado versus realizado considerando todos os serviços do pacote."
            headerAside={<span className="font-medium text-foreground">{realizedHeaderLabel}</span>}
            chartHeight={360}
            metrics={curveMetrics}
            deferRendering
            fallback={
              <div className="flex h-[360px] w-full items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/40">
                <span className="text-sm text-muted-foreground">Carregando gráfico...</span>
              </div>
            }
          />
        </section>

        <section className="rounded-2xl border bg-card/80 p-5 shadow-sm print:hidden">
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
        <div className="space-y-6 print:hidden">
          <PackageFoldersManagerClient
            packageId={pkg.id}
            services={availableServiceOptions}
            serviceDetails={serviceDetails}
            initialFolders={folders}
          />

          <ServicesCompaniesSection folders={folders} serviceDetails={serviceDetails} />
        </div>

        <div className="hidden print:block print-page-break-before" aria-hidden>
          <ServicesCompaniesSection
            folders={folders}
            serviceDetails={serviceDetails}
            forceExpandAll
            printLayout
          />
        </div>
      </div>

      <section className="rounded-2xl border bg-card/80 p-5 shadow-sm space-y-8">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Resumo por Subpacote</h2>
          {subpackageMetrics.length ? (
            <div className="overflow-x-auto rounded-xl border bg-card">
              <table className="summary-table mt-2 min-w-full border border-border border-collapse text-center">
                <thead className="bg-muted/80 text-foreground">
                  <tr>
                    <th className="border border-border p-3 text-left">Subpacote</th>
                    <th className="border border-border p-3">% Atual ({referenceLabel})</th>
                    <th className="border border-border p-3">% Deveria Estar ({referenceLabel})</th>
                    <th className="border border-border p-3">Horas Faltando</th>
                    <th className="border border-border p-3">Diferença</th>
                  </tr>
                </thead>
                <tbody className="text-foreground">
                  {subpackageMetrics.map((metric) => (
                    <tr key={metric.nome} className="odd:bg-muted/40">
                      <td className="border border-border p-3 text-left font-medium">{metric.nome}</td>
                      <td className="border border-border p-3 font-semibold">
                        {formatMetricValue(metric.realizedPercent)}%
                      </td>
                      <td className="border border-border p-3 font-semibold">
                        {formatMetricValue(metric.plannedPercent)}%
                      </td>
                      <td className="border border-border p-3 font-semibold">
                        {formatMetricValue(metric.horasFaltando)}
                      </td>
                      <td className="border border-border p-3 font-semibold">
                        {formatMetricValue(metric.diferenca)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Não há subpacotes cadastrados para este pacote.
            </p>
          )}
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Resumo por Setor</h2>
          {sectorMetrics.length ? (
            <div className="overflow-x-auto rounded-xl border bg-card">
              <table className="summary-table mt-2 min-w-full border border-border border-collapse text-center">
                <thead className="bg-muted/80 text-foreground">
                  <tr>
                    <th className="border border-border p-3 text-left">Setor</th>
                    <th className="border border-border p-3">% Atual ({referenceLabel})</th>
                    <th className="border border-border p-3">% Deveria Estar ({referenceLabel})</th>
                    <th className="border border-border p-3">Horas Faltando</th>
                    <th className="border border-border p-3">Diferença</th>
                  </tr>
                </thead>
                <tbody className="text-foreground">
                  {sectorMetrics.map((metric) => (
                    <tr key={metric.setor} className="odd:bg-muted/40">
                      <td className="border border-border p-3 text-left font-medium">{metric.setor}</td>
                      <td className="border border-border p-3 font-semibold">
                        {formatMetricValue(metric.realizedPercent)}%
                      </td>
                      <td className="border border-border p-3 font-semibold">
                        {formatMetricValue(metric.plannedPercent)}%
                      </td>
                      <td className="border border-border p-3 font-semibold">
                        {formatMetricValue(metric.horasFaltando)}
                      </td>
                      <td className="border border-border p-3 font-semibold">
                        {formatMetricValue(metric.diferenca)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Não há setores cadastrados para este pacote.
            </p>
          )}
        </div>
      </section>
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

export default async function PackageDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  try {
    return await renderPackageDetailPage(params, searchParams);
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
