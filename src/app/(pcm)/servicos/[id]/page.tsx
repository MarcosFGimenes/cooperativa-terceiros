import Link from "next/link";

import ServiceGraphSection from "./_components/ServiceGraphSection";
import ServiceEditorClient from "./ServiceEditorClient";

import { curvaPlanejada, curvaRealizada } from "@/lib/curvaS";
import { getService } from "@/lib/repo/services";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

const parseISODate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

export default async function ServiceDetailPage({ params }: Params) {
  const { id } = params;

  const [service, atual] = await Promise.all([getService(id), curvaRealizada(id)]);

  const inicio = service ? parseISODate(service.plannedStart) : null;
  const fim = service ? parseISODate(service.plannedEnd) : null;

  const planejada = service && (inicio || fim)
    ? curvaPlanejada(inicio ?? fim ?? new Date(), fim ?? inicio ?? new Date(), service.totalHours ?? 0)
    : [];

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Serviço #{id}</h1>
          <p className="text-sm text-muted-foreground">
            Consulte e edite os dados cadastrados, checklist e histórico de atualizações.
          </p>
        </div>
        <Link className="btn-secondary" href="/servicos">
          Voltar
        </Link>
      </div>

      <div className="space-y-6">
        <ServiceGraphSection service={service} planned={planejada} actual={atual} />
        <ServiceEditorClient serviceId={id} />
      </div>
    </div>
  );
}
