"use client";

import { useState } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export type ServiceSummary = {
  id: string;
  label: string;
  companyLabel: string;
  status: string;
  progress: number | null;
  folders: string[];
};

export type FolderDisplay = {
  id: string;
  name: string;
  companyId?: string | null;
  services: string[];
};

export type ServiceDetail = {
  id: string;
  label: string;
  status: string;
  companyLabel?: string;
};

export type ServiceDetailsMap = Record<string, ServiceDetail | undefined>;

type Props = {
  services: ServiceSummary[];
  folders: FolderDisplay[];
  serviceDetails: ServiceDetailsMap;
};

export default function ServicesCompaniesSection({ services, folders, serviceDetails }: Props) {
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);

  return (
    <div className="card space-y-6 p-4">
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
              const isOpen = openFolderId === folder.id;
              return (
                <div key={folder.id} className="rounded-lg border">
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition",
                      isOpen ? "bg-muted/60" : "hover:bg-muted/40",
                    )}
                    onClick={() => setOpenFolderId((current) => (current === folder.id ? null : folder.id))}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{folder.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        Empresa: {folder.companyId ? folder.companyId : "-"}
                      </p>
                    </div>
                    <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                      {folder.services.length} serviço{folder.services.length === 1 ? "" : "s"}
                    </span>
                  </button>
                  {isOpen ? (
                    <div className="space-y-2 border-t px-3 py-3 text-sm">
                      {assignedServices.length === 0 ? (
                        <p className="text-muted-foreground">Nenhum serviço vinculado a este subpacote.</p>
                      ) : (
                        assignedServices.map((detail) => (
                          <div key={detail.id} className="rounded border bg-background px-3 py-2">
                            <p className="font-medium text-foreground">{detail.label || detail.id}</p>
                            <p className="text-xs text-muted-foreground">
                              ID: {detail.id}
                              {detail.status ? ` • ${detail.status}` : ""}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Serviços do pacote</h3>
            <p className="text-xs text-muted-foreground">{services.length} serviço{services.length === 1 ? "" : "s"} associados.</p>
          </div>
        </div>
        {services.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum serviço vinculado ao pacote.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {services.map((service) => (
              <li key={service.id} className="flex flex-wrap items-center justify-between gap-3 rounded border p-3">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/servicos/${service.id}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {service.label}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    {service.status}
                    {service.companyLabel ? ` • ${service.companyLabel}` : ""}
                    {service.folders.length ? ` • Subpacotes: ${service.folders.join(", ")}` : ""}
                  </p>
                </div>
                {typeof service.progress === "number" ? (
                  <span className="text-sm font-semibold text-primary">{service.progress}%</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
