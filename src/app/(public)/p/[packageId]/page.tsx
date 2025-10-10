"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getPackage } from "@/lib/repo/packages";
import { listServicesByPackage, listServiceUpdates } from "@/lib/repo/services";
import { buildServiceSeries, aggregatePackageSeries } from "@/lib/sCurve";
import SCurve from "@/components/SCurve";
import PdfExportBar from "@/components/PdfExportBar";

type ServiceWithComputed = {
  id: string;
  title: string;
  companyId: string;
  status: "aberto" | "encerrado";
  totalHoursPlanned: number;
  lastProgress: number;
  series: { date: string; progress: number }[];
};

export default function PackagePublicPage() {
  const { packageId } = useParams<{ packageId: string }>();
  const [pkg, setPkg] = useState<any>(null);
  const [services, setServices] = useState<ServiceWithComputed[]>([]);
  const [filter, setFilter] = useState<"todos"|"aberto"|"encerrado">("todos");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const p = await getPackage(packageId);
      const svc = await listServicesByPackage(packageId);

      // Para cada serviço, buscamos updates e montamos série
      const enriched: ServiceWithComputed[] = await Promise.all(svc.map(async s => {
        const ups = await listServiceUpdates(s.id!);
        const start = s.startedAt ?? new Date();
        const last = new Date();
        const series = buildServiceSeries(start, last, ups.map(u => ({ createdAt: u.createdAt, progress: u.progress })));
        const lastProgress = ups.at(-1)?.progress ?? 0;
        return {
          id: s.id!,
          title: s.title,
          companyId: s.companyId,
          status: s.status,
          totalHoursPlanned: s.totalHoursPlanned,
          lastProgress,
          series,
        };
      }));

      if (!alive) return;
      setPkg(p);
      setServices(enriched);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [packageId]);

  const filteredServices = useMemo(() => {
    if (filter === "todos") return services;
    return services.filter(s => s.status === filter);
  }, [services, filter]);

  const aggregate = useMemo(() => {
    if (filteredServices.length === 0) return [];
    return aggregatePackageSeries(filteredServices.map(s => ({
      totalHoursPlanned: s.totalHoursPlanned,
      series: s.series
    })));
  }, [filteredServices]);

  if (loading) return <div className="p-6">Carregando…</div>;
  if (!pkg) return <div className="p-6">Pacote não encontrado.</div>;

  // progress geral (último ponto da agregada)
  const overall = aggregate.at(-1)?.progress ?? 0;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            Pacote: {pkg.name} <span className="text-sm text-gray-500">({packageId})</span>
          </h1>
          <div className="text-sm text-gray-600">
            Status: {pkg.status} • Serviços: {services.length} • Progresso geral: {overall}%
          </div>
        </div>
        <PdfExportBar targetId="print-area" filename={`pacote-${packageId}.pdf`} />
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        <button
          onClick={()=>setFilter("todos")}
          className={`px-3 py-1 rounded border ${filter==="todos" ? "bg-black text-white" : ""}`}
        >Todos</button>
        <button
          onClick={()=>setFilter("aberto")}
          className={`px-3 py-1 rounded border ${filter==="aberto" ? "bg-black text-white" : ""}`}
        >Em andamento</button>
        <button
          onClick={()=>setFilter("encerrado")}
          className={`px-3 py-1 rounded border ${filter==="encerrado" ? "bg-black text-white" : ""}`}
        >Concluídos</button>
      </div>

      <div id="print-area" className="space-y-4">
        {/* Curva S consolidada */}
        <div>
          <div className="font-medium mb-2">Curva S (consolidada)</div>
          <SCurve data={aggregate} />
        </div>

        {/* Lista de serviços do pacote */}
        <div>
          <div className="font-medium mb-2">Serviços do pacote</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredServices.map(s => (
              <a key={s.id} href={`/s/${s.id}`} className="border rounded p-3 hover:bg-gray-50">
                <div className="font-semibold">{s.title}</div>
                <div className="text-sm text-gray-600">
                  Empresa: {s.companyId} • Status: {s.status} • Horas: {s.totalHoursPlanned}
                </div>
                <div className="text-sm">Progresso atual: <b>{s.lastProgress}%</b></div>
              </a>
            ))}
          </div>
          {filteredServices.length === 0 && (
            <div className="text-sm text-gray-500">Nenhum serviço neste filtro.</div>
          )}
        </div>
      </div>
    </div>
  );
}
