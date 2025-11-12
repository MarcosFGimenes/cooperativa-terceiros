export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { notFound } from "next/navigation";

import ServiceEditorClient from "../ServiceEditorClient";
import { getService, getServiceById } from "@/lib/repo/services";

export default async function ServiceEditPage({ params }: { params: { id: string } }) {
  const [service, legacyService] = await Promise.all([
    getServiceById(params.id),
    getService(params.id),
  ]);

  const baseService = service ?? legacyService;
  if (!baseService) notFound();

  const serviceLabel =
    baseService.os?.trim() ||
    baseService.tag?.trim() ||
    baseService.code?.trim() ||
    params.id;

  return (
    <div className="container mx-auto space-y-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Editar serviço {serviceLabel}</h1>
          <p className="text-sm text-muted-foreground">
            Atualize os dados gerais, checklist e histórico de medições do serviço.
          </p>
        </div>
        <Link className="btn btn-secondary" href={`/servicos/${encodeURIComponent(params.id)}`}>
          Voltar
        </Link>
      </div>

      <ServiceEditorClient serviceId={params.id} />
    </div>
  );
}
