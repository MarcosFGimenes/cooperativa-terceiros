"use client";
import RequireAuth from "@/components/RequireAuth";
import PageHeader from "@/components/PageHeader";
import { Stat } from "@/components/Stats";
import { listServices, listPackages, type Service } from "@/lib/db";
import { useEffect, useState } from "react";

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<{abertos:number; pacotes:number; horas:number; media:number}>({abertos:0,pacotes:0,horas:0,media:0});
  const [recent, setRecent] = useState<Service[]>([]);

  useEffect(() => {
    (async () => {
      const [servs, pacs] = await Promise.all([listServices(), listPackages()]);
      const abertos = servs.filter(s => s.status === "Aberto").length;
      const pacotes = pacs.length;
      const horas = servs.reduce((a,b) => a + (b.horasPrevistas ?? 0), 0);
      const comAnd = servs.filter(s => typeof s.andamento === "number");
      const media = comAnd.length ? Math.round(comAnd.reduce((a,b)=>a+(b.andamento??0),0)/comAnd.length) : 0;
      setMetrics({abertos,pacotes,horas,media});
      setRecent(servs.slice(0,5));
    })();
  }, []);

  return (
    <RequireAuth>
      <div className="container-page">
        <PageHeader title="Dashboard" subtitle="Visão geral dos serviços e pacotes" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Serviços abertos" value={metrics.abertos} />
          <Stat label="Pacotes ativos" value={metrics.pacotes} />
          <Stat label="Horas previstas (total)" value={metrics.horas} />
          <Stat label="Avanço médio (%)" value={`${metrics.media}%`} />
        </div>

        <div className="mt-8 card">
          <div className="mb-3 text-sm font-medium text-muted-foreground">Últimos serviços</div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>O.S</th><th>Equipamento</th><th>Status</th><th>Andamento</th></tr></thead>
              <tbody>
                {recent.map((s) => (
                  <tr key={s.id}>
                    <td>{s.os}</td>
                    <td>{s.equipamento ?? "-"}</td>
                    <td>{s.status ?? "-"}</td>
                    <td>{typeof s.andamento === "number" ? `${s.andamento}%` : "-"}</td>
                  </tr>
                ))}
                {recent.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">Nenhum serviço encontrado.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </RequireAuth>
  );
}
