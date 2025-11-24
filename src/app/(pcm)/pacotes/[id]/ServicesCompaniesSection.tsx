"use client";

import { useState } from "react";

import { formatDate } from "@/lib/formatDateTime";
import { cn } from "@/lib/utils";

export type FolderDisplay = {
  id: string;
  name: string;
  companyId?: string | null;
  services: string[];
  progressPercent?: number | null;
  realizedPercent?: number | null;
  startDateMs?: number | null;
  endDateMs?: number | null;
};

export type ServiceDetail = {
  id: string;
  label: string;
  status: string;
  companyLabel?: string;
  plannedPercent?: number | null;
  realizedPercent?: number | null;
  deltaPercent?: number | null;
  startDateMs?: number | null;
  endDateMs?: number | null;
};

export type ServiceDetailsMap = Record<string, ServiceDetail | undefined>;

type Props = {
  folders: FolderDisplay[];
  serviceDetails: ServiceDetailsMap;
  forceExpandAll?: boolean;
  printLayout?: boolean;
};

export default function ServicesCompaniesSection({
  folders,
  serviceDetails,
  forceExpandAll = false,
  printLayout = false,
}: Props) {
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  const [expandedFolderServices, setExpandedFolderServices] = useState<Record<string, boolean>>({});
  const MAX_VISIBLE_SERVICES = 5;

  const formatPercentLabel = (value: number | null | undefined, hasServices: boolean) => {
    if (!hasServices) return "Sem serviços";
    if (typeof value === "number" && Number.isFinite(value)) {
      return `${Math.round(value)}%`;
    }
    return "0%";
  };

  const formatDateLabel = (value?: number | null) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return "-";
    return formatDate(value, { timeZone: "America/Sao_Paulo", fallback: "-" }) || "-";
  };

  const formatDeltaLabel = (value?: number | null) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return "0%";
    const rounded = Math.round(value);
    if (rounded > 0) return `+${rounded}%`;
    return `${rounded}%`;
  };

  const containerClass = printLayout ? "space-y-6 p-4" : "card space-y-6 p-4";

  return (
    <div className={cn(containerClass, "services-companies space-y-6")}>
      <div>
        <h2 className="text-lg font-semibold">Serviços e Empresas</h2>
        <p className="text-xs text-muted-foreground">
          Consulte os subpacotes criados, visualize os serviços atribuídos e acompanhe todos os serviços do pacote.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Subpacotes</h3>
          {folders.length ? (
            <span className="text-xs text-muted-foreground">{folders.length} subpacote{folders.length === 1 ? "" : "s"}</span>
          ) : null}
        </div>
        {folders.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum subpacote foi criado para este pacote. Utilize o formulário abaixo para cadastrar e distribuir os serviços
            entre empresas.
          </p>
        ) : (
          <div className="space-y-2">
            {folders.map((folder) => {
              const assignedServices = folder.services.map((serviceId) => {
                const detail = serviceDetails[serviceId];
                if (detail) {
                  return detail;
                }
                return {
                  id: serviceId,
                  label: serviceId,
                  status: "Desconhecido",
                } satisfies ServiceDetail;
              });
              const hasServices = folder.services.length > 0;
              const plannedLabel = formatPercentLabel(folder.progressPercent, hasServices);
              const realizedLabel = formatPercentLabel(folder.realizedPercent, hasServices);
              const startLabel = formatDateLabel(folder.startDateMs);
              const endLabel = formatDateLabel(folder.endDateMs);
              const isAlwaysOpen = forceExpandAll;
              const isOpen = isAlwaysOpen || openFolderId === folder.id;
              const isExpanded = isAlwaysOpen || (expandedFolderServices[folder.id] ?? false);
              const visibleServices = isExpanded
                ? assignedServices
                : assignedServices.slice(0, MAX_VISIBLE_SERVICES);
              const hiddenCount = isAlwaysOpen ? 0 : assignedServices.length - visibleServices.length;
              return (
                <div key={folder.id} className="subpackage-block rounded-lg border border-slate-200 bg-slate-100">
                  <button
                    type="button"
                    className={cn(
                      "company-header flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition subpackage-header",
                      "bg-slate-100 text-slate-900",
                      !isAlwaysOpen ? "hover:bg-slate-200" : "",
                      isAlwaysOpen ? "cursor-default" : "",
                    )}
                    onClick={() =>
                      setOpenFolderId((current) => (isAlwaysOpen ? current : current === folder.id ? null : folder.id))
                    }
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate text-sm font-semibold text-slate-900">{folder.name}</p>
                      <p className="truncate text-xs text-slate-700">
                        Empresa: {folder.companyId ? folder.companyId : "-"}
                      </p>
                      <p className="truncate text-xs text-slate-700">
                        Planejado hoje: <span className="font-semibold text-slate-900">{plannedLabel}</span>
                      </p>
                      <p className="truncate text-xs text-slate-700">
                        Realizado: <span className="font-semibold text-slate-900">{realizedLabel}</span>
                      </p>
                      <p className="truncate text-xs text-slate-700">
                        Cronograma: <span className="font-semibold text-slate-900">{startLabel}</span> —{' '}
                        <span className="font-semibold text-slate-900">{endLabel}</span>
                      </p>
                    </div>
                    <span className="rounded-full border border-slate-300 bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-800">
                      {folder.services.length} serviço{folder.services.length === 1 ? "" : "s"}
                    </span>
                  </button>
                  {isOpen ? (
                    <div className="service-list space-y-2 px-3 pb-4 pt-2 text-sm">
                      {assignedServices.length === 0 ? (
                        <p className="text-muted-foreground">Nenhum serviço vinculado a este subpacote.</p>
                      ) : (
                        <>
                          {visibleServices.map((detail) => (
                            <div
                              key={detail.id}
                              className="service-card service-entry rounded border border-slate-200 bg-white text-slate-900 shadow-sm"
                            >
                              <div className="service-title flex items-center justify-between gap-2 rounded-t border-b border-slate-200 bg-slate-100 px-3 py-2">
                                <p className="font-semibold text-slate-900">{detail.label || detail.id}</p>
                                {detail.status ? (
                                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-800">
                                    {detail.status}
                                  </span>
                                ) : null}
                              </div>
                              <div className="service-content space-y-1 px-3 py-2 text-xs text-slate-800">
                                <p>
                                  Planejado: {formatPercentLabel(detail.plannedPercent ?? null, true)} • Realizado: {" "}
                                  {formatPercentLabel(detail.realizedPercent ?? null, true)} • Dif.: {" "}
                                  <span className="font-semibold text-slate-900">{formatDeltaLabel(detail.deltaPercent)}</span>
                                </p>
                                <p>
                                  Cronograma: <span className="font-semibold text-slate-900">{formatDateLabel(detail.startDateMs)}</span>
                                  {" "}—{" "}
                                  <span className="font-semibold text-slate-900">{formatDateLabel(detail.endDateMs)}</span>
                                </p>
                              </div>
                            </div>
                          ))}
                          {!isAlwaysOpen && hiddenCount > 0 ? (
                            <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                              <span>
                                Mostrando {visibleServices.length} de {assignedServices.length} serviço
                                {assignedServices.length === 1 ? "" : "s"}.
                              </span>
                              <button
                                type="button"
                                className="btn btn-ghost text-xs"
                                onClick={() =>
                                  setExpandedFolderServices((prev) => ({
                                    ...prev,
                                    [folder.id]: true,
                                  }))
                                }
                              >
                                Mostrar mais
                              </button>
                            </div>
                          ) : !isAlwaysOpen && assignedServices.length > MAX_VISIBLE_SERVICES ? (
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <button
                                type="button"
                                className="btn btn-ghost text-xs"
                                onClick={() =>
                                  setExpandedFolderServices((prev) => ({
                                    ...prev,
                                    [folder.id]: false,
                                  }))
                                }
                              >
                                Mostrar menos
                              </button>
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
