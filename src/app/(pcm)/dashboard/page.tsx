import DashboardFilters from "./_components/Filters";
import ServiceRowActions from "./_components/ServiceRowActions";
import { listServices } from "@/lib/repo/services";
import type { Service } from "@/lib/types";
import PageHeader from "@/components/PageHeader";

type DashboardPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const STATUS_LABEL: Record<Service["status"], string> = {
  aberto: "Aberto",
  concluido: "Concluído",
  encerrado: "Encerrado",
};

function normaliseParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function formatPercent(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "0%";
  return `${value.toFixed(1)}%`;
}

function computeCompanyStats(services: Service[]) {
  const counts = new Map<string, number>();
  services.forEach((service) => {
    const key = service.company?.trim() || "Sem empresa";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
}

export default async function Page({ searchParams }: DashboardPageProps) {
  const resolvedParams = (await searchParams) ?? {};
  const statusParam = normaliseParam(resolvedParams.status);
  const companyParam = normaliseParam(resolvedParams.company);
  const packageParam = normaliseParam(resolvedParams.package);

  const validStatus = statusParam === "aberto" || statusParam === "concluido" || statusParam === "encerrado" ? statusParam : undefined;
  const validCompany = typeof companyParam === "string" && companyParam ? companyParam : undefined;
  const validPackage = typeof packageParam === "string" && packageParam ? packageParam : undefined;

  let services: Service[] = [];
  try {
    services = await listServices();
  } catch (error) {
    console.error("[dashboard] Falha ao carregar serviços", error);
  }

  const filteredServices = services.filter((service) => {
    if (validStatus && service.status !== validStatus) return false;
    if (validCompany && service.company !== validCompany) return false;
    if (validPackage && service.packageId !== validPackage) return false;
    return true;
  });

  const openCount = services.filter((service) => service.status === "aberto").length;
  const concludedCount = services.filter((service) => service.status === "concluido").length;
  const closedCount = services.filter((service) => service.status === "encerrado").length;
  const averagePercent = services.length
    ? services.reduce((acc, service) => acc + (Number(service.realPercent) || 0), 0) / services.length
    : 0;

  const companies = Array.from(new Set(services.map((service) => service.company).filter(Boolean))) as string[];
  const packages = Array.from(new Set(services.map((service) => service.packageId).filter(Boolean))) as string[];
  const companyStats = computeCompanyStats(services);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard PCM"
        description="Acompanhe o andamento dos serviços, gere tokens de acesso e exporte relatórios rapidamente."
      />

      <DashboardFilters
        companies={companies}
        packages={packages}
        current={{ status: validStatus, company: validCompany, packageId: validPackage }}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="card p-4">
          <div className="text-sm text-muted-foreground">Serviços abertos</div>
          <div className="mt-2 text-3xl font-semibold text-foreground">{openCount}</div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-muted-foreground">Serviços concluídos</div>
          <div className="mt-2 text-3xl font-semibold text-foreground">{concludedCount}</div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-muted-foreground">Serviços encerrados</div>
          <div className="mt-2 text-3xl font-semibold text-foreground">{closedCount}</div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-muted-foreground">% médio realizado</div>
          <div className="mt-2 text-3xl font-semibold text-foreground">{formatPercent(averagePercent)}</div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold tracking-tight">Serviços por empresa</h2>
        <ul className="mt-4 space-y-2">
          {companyStats.map(([company, count]) => (
            <li key={company} className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground/80">{company}</span>
              <span className="rounded-md bg-accent px-2 py-1 text-xs font-semibold text-accent-foreground">{count}</span>
            </li>
          ))}
          {companyStats.length === 0 ? (
            <li className="text-sm text-muted-foreground">Nenhum serviço cadastrado.</li>
          ) : null}
        </ul>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b px-4 py-3">
          <h2 className="text-lg font-semibold tracking-tight">Serviços</h2>
          <p className="text-sm text-muted-foreground">Filtre, edite e exporte informações diretamente da tabela.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">OS</th>
                <th className="px-4 py-3 font-semibold">Equipamento</th>
                <th className="px-4 py-3 font-semibold">Empresa</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">% realizado</th>
                <th className="px-4 py-3 font-semibold">Pacote</th>
                <th className="px-4 py-3 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredServices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    Nenhum serviço encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : null}
              {filteredServices.map((service) => (
                <tr key={service.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{service.os || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{service.equipmentName || "—"}</div>
                    <div className="text-xs text-muted-foreground">Tag {service.tag || "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-sm">{service.company || "—"}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">
                      {STATUS_LABEL[service.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{formatPercent(service.realPercent)}</td>
                  <td className="px-4 py-3 text-sm">{service.packageId || "—"}</td>
                  <td className="px-4 py-3">
                    <ServiceRowActions service={{ id: service.id, os: service.os, company: service.company }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
