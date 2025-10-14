import Link from "next/link";
import { notFound } from "next/navigation";

import ChecklistManager from "./_components/ChecklistManager";
import ServiceMetadataForm from "./_components/ServiceMetadataForm";
import ServiceTimeline from "@/components/ServiceTimeline";
import { getChecklist, getService, listUpdates } from "@/lib/repo/services";
import ServiceGraphSection from "./_components/ServiceGraphSection";
import PageHeader from "@/components/PageHeader";
import BackButton from "@/components/BackButton";

const TABS = [
  { id: "details", label: "Detalhes" },
  { id: "checklist", label: "Checklist" },
  { id: "updates", label: "Atualizações" },
  { id: "graph", label: "Gráfico" },
] as const;

const STATUS_LABEL = {
  aberto: "Aberto",
  concluido: "Concluído",
  encerrado: "Encerrado",
} as const;

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
    <div className="space-y-6">
      <PageHeader
        title={`Serviço ${service.os || service.id}`}
        description="Gerencie dados, checklist, atualizações e relatórios do serviço selecionado."
        actions={<BackButton />}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card p-4">
          <div className="text-sm text-muted-foreground">Status</div>
          <div className="mt-2 text-lg font-semibold text-foreground">
            {STATUS_LABEL[service.status as keyof typeof STATUS_LABEL] ?? service.status}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-muted-foreground">Percentual realizado</div>
          <div className="mt-2 text-lg font-semibold text-foreground">{Number(service.realPercent ?? 0).toFixed(1)}%</div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-muted-foreground">Checklist</div>
          <div className="mt-2 text-lg font-semibold text-foreground">
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
              className={`btn-ghost text-sm ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {activeTab === "details" ? (
        <section className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">Dados do serviço</h2>
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
      ) : null}

      {activeTab === "checklist" ? (
        <section className="card p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight">Checklist do serviço</h2>
            <span className="text-sm text-muted-foreground">Itens atuais: {checklistDraft.length}</span>
          </div>
          <ChecklistManager serviceId={service.id} initialItems={checklistDraft} />
        </section>
      ) : null}

      {activeTab === "updates" ? (
        <section className="card p-6">
          <h2 className="text-lg font-semibold tracking-tight">Atualizações</h2>
          {timelineItems.length > 0 ? (
            <ServiceTimeline items={timelineItems} />
          ) : (
            <div className="mt-4 rounded-md border border-dashed border-border/70 bg-muted/40 p-4 text-sm text-muted-foreground">
              Nenhuma atualização registrada até o momento.
            </div>
          )}
        </section>
      ) : null}

      {activeTab === "graph" ? <ServiceGraphSection service={service} /> : null}
    </div>
  );
}
