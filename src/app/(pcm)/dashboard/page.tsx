import DashboardFilters from "./_components/Filters";
import ServiceRowActions from "./_components/ServiceRowActions";
import { listServices } from "@/lib/repo/services";
import type { Service } from "@/lib/types";

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
    <div className="space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard PCM</h1>
        <p className="text-sm text-gray-600">
          Acompanhe o andamento dos serviços, gere tokens de acesso e exporte relatórios rapidamente.
        </p>
      </div>

      <DashboardFilters
        companies={companies}
        packages={packages}
        current={{ status: validStatus, company: validCompany, packageId: validPackage }}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-500">Serviços abertos</div>
          <div className="mt-2 text-3xl font-bold text-gray-900">{openCount}</div>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-500">Serviços concluídos</div>
          <div className="mt-2 text-3xl font-bold text-gray-900">{concludedCount}</div>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-500">Serviços encerrados</div>
          <div className="mt-2 text-3xl font-bold text-gray-900">{closedCount}</div>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-500">% médio realizado</div>
          <div className="mt-2 text-3xl font-bold text-gray-900">{formatPercent(averagePercent)}</div>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Serviços por empresa</h2>
        <ul className="mt-3 space-y-2">
          {companyStats.map(([company, count]) => (
            <li key={company} className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-700">{company}</span>
              <span className="rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">{count}</span>
            </li>
          ))}
          {companyStats.length === 0 && (
            <li className="text-sm text-gray-500">Nenhum serviço cadastrado.</li>
          )}
        </ul>
      </div>

      <div className="rounded-lg border bg-white shadow-sm">
        <div className="border-b px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-900">Serviços</h2>
          <p className="text-sm text-gray-500">Filtre, edite e exporte informações diretamente da tabela.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium uppercase tracking-wider text-gray-500">OS</th>
                <th className="px-4 py-2 text-left font-medium uppercase tracking-wider text-gray-500">Equipamento</th>
                <th className="px-4 py-2 text-left font-medium uppercase tracking-wider text-gray-500">Empresa</th>
                <th className="px-4 py-2 text-left font-medium uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-4 py-2 text-left font-medium uppercase tracking-wider text-gray-500">% realizado</th>
                <th className="px-4 py-2 text-left font-medium uppercase tracking-wider text-gray-500">Pacote</th>
                <th className="px-4 py-2 text-left font-medium uppercase tracking-wider text-gray-500">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredServices.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-500">
                    Nenhum serviço encontrado com os filtros selecionados.
                  </td>
                </tr>
              )}
              {filteredServices.map((service) => (
                <tr key={service.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{service.os || "—"}</td>
                  <td className="px-4 py-3 text-gray-700">
                    <div className="font-medium">{service.equipmentName || "—"}</div>
                    <div className="text-xs text-gray-500">Tag {service.tag || "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{service.company || "—"}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                      {STATUS_LABEL[service.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{formatPercent(service.realPercent)}</td>
                  <td className="px-4 py-3 text-gray-700">{service.packageId || "—"}</td>
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
