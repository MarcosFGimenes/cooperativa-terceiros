import Link from "next/link";
import { notFound } from "next/navigation";

import ChecklistManager from "./_components/ChecklistManager";
import ServiceMetadataForm from "./_components/ServiceMetadataForm";
import PdfExportBar from "@/components/PdfExportBar";
import SCurve from "@/components/SCurve";
import ServiceTimeline from "@/components/ServiceTimeline";
import { plannedSeries, realizedSeries, mergeToSCurve } from "@/lib/scurve";
import { getChecklist, getService, listUpdates } from "@/lib/repo/services";

const TABS = [
  { id: "details", label: "Detalhes" },
  { id: "checklist", label: "Checklist" },
  { id: "updates", label: "Atualizações" },
  { id: "graph", label: "Gráfico" },
] as const;

type PageProps = {
  params: { id: string };
  searchParams?: Promise<{ tab?: string }>;
};

function normaliseDate(value?: number | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR");
}

function getActiveTab(param?: string) {
  const found = TABS.find((tab) => tab.id === param);
  return found?.id ?? "details";
}

export default async function Page({ params, searchParams }: PageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};

  let service: Awaited<ReturnType<typeof getService>> | null = null;
  try {
    service = await getService(params.id);
  } catch (error) {
    console.error("[servicos/id] Falha ao carregar serviço", error);
  }

  if (!service) {
    notFound();
  }

  let checklist: Awaited<ReturnType<typeof getChecklist>> = [];
  let updates: Awaited<ReturnType<typeof listUpdates>> = [];
  try {
    [checklist, updates] = await Promise.all([
      getChecklist(service.id),
      listUpdates(service.id, 100),
    ]);
  } catch (error) {
    console.error("[servicos/id] Falha ao carregar checklist ou updates", error);
  }

  const planned = plannedSeries(service);
  let realized: Awaited<ReturnType<typeof realizedSeries>> = [];
  try {
    realized = await realizedSeries(service.id);
  } catch (error) {
    console.error("[servicos/id] Falha ao carregar curva real", error);
  }
  const merged = mergeToSCurve(planned, realized);
  const scurveData = merged.labels.map((date, index) => ({
    date,
    planned: merged.planned[index] ?? 0,
    realized: merged.realized[index] ?? 0,
  }));

  const timelineItems = updates
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((item) => ({
      date: normaliseDate(item.createdAt),
      progress: Number(item.manualPercent ?? item.realPercentSnapshot ?? 0),
      note: item.note,
    }));

  const activeTab = getActiveTab(resolvedSearchParams.tab);
  const basePath = `/(pcm)/servicos/${service.id}`;

  const checklistDraft = checklist.map((item) => ({
    id: item.id,
    description: item.description,
    weight: item.weight,
  }));

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900">Serviço {service.os || service.id}</h1>
        <p className="text-sm text-gray-600">
          Gerencie todos os aspectos do serviço: dados cadastrais, checklist, atualizações e relatórios de progresso.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-500">Status</div>
          <div className="mt-1 text-xl font-semibold text-gray-900">{service.status.toUpperCase()}</div>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-500">Percentual realizado</div>
          <div className="mt-1 text-xl font-semibold text-gray-900">{Number(service.realPercent ?? 0).toFixed(1)}%</div>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-500">Checklist</div>
          <div className="mt-1 text-xl font-semibold text-gray-900">
            {service.hasChecklist ? "Ativo" : "Não configurado"}
          </div>
        </div>
      </div>

      <nav className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <Link
              key={tab.id}
              href={`${basePath}?tab=${tab.id}`}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                isActive ? "bg-black text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {activeTab === "details" && (
        <section className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Dados do serviço</h2>
          <ServiceMetadataForm
            serviceId={service.id}
            initial={{
              os: service.os,
              oc: service.oc,
              tag: service.tag,
              equipmentName: service.equipmentName,
              sector: service.sector,
              plannedStart: service.plannedStart,
              plannedEnd: service.plannedEnd,
              totalHours: service.totalHours,
              company: service.company,
              status: service.status,
            }}
          />
        </section>
      )}

      {activeTab === "checklist" && (
        <section className="rounded-lg border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Checklist do serviço</h2>
            <span className="text-sm text-gray-500">Itens atuais: {checklistDraft.length}</span>
          </div>
          <div className="mt-4">
            <ChecklistManager serviceId={service.id} initialItems={checklistDraft} />
          </div>
        </section>
      )}

      {activeTab === "updates" && (
        <section className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Atualizações</h2>
          {timelineItems.length > 0 ? (
            <ServiceTimeline items={timelineItems} />
          ) : (
            <p className="mt-3 text-sm text-gray-500">Nenhuma atualização registrada até o momento.</p>
          )}
        </section>
      )}

      {activeTab === "graph" && (
        <section className="space-y-4 rounded-lg border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Curva S</h2>
              <p className="text-sm text-gray-500">
                Compare a evolução planejada com o progresso real do serviço.
              </p>
            </div>
            <PdfExportBar targetId="service-curve" filename={`curva-s-${service.id}.pdf`} />
          </div>
          <div id="service-curve">
            {scurveData.length > 0 ? (
              <SCurve data={scurveData} />
            ) : (
              <p className="text-sm text-gray-500">Sem dados suficientes para gerar o gráfico.</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
