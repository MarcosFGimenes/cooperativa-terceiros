"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getService, listServiceUpdates, addServiceUpdate } from "@/lib/repo/services";
import { buildServiceSeries } from "@/lib/sCurve";
import SCurve from "@/components/SCurve";
import ServiceUpdateForm from "@/components/ServiceUpdateForm";
import ServiceTimeline from "@/components/ServiceTimeline";
import PdfExportBar from "@/components/PdfExportBar";

export default function ServicePublicPage() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const [svc, setSvc] = useState<any>(null);
  const [updates, setUpdates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const s = await getService(serviceId);
      const u = await listServiceUpdates(serviceId);
      if (!alive) return;
      setSvc(s);
      setUpdates(u);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [serviceId]);

  const series = useMemo(() => {
    if (!svc) return [];
    const start = svc.startedAt ?? new Date();
    const last = new Date();
    return buildServiceSeries(start, last, updates.map(u => ({ createdAt: u.createdAt, progress: u.progress })));
  }, [svc, updates]);

  const lastProgress = updates.at(-1)?.progress ?? 0;

  async function onSaveUpdate({ progress, note }: { progress: number; note?: string }) {
    await addServiceUpdate(serviceId, { progress, note });
    // reload rápido
    const u = await listServiceUpdates(serviceId);
    setUpdates(u);
  }

  if (loading) return <div className="p-6">Carregando…</div>;
  if (!svc) return <div className="p-6">Serviço não encontrado.</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{svc.title} <span className="text-sm text-gray-500">({serviceId})</span></h1>
        <PdfExportBar targetId="print-area" filename={`servico-${serviceId}.pdf`} />
      </div>

      <div id="print-area" className="space-y-4">
        <div className="text-sm text-gray-600">
          Status: {svc.status} • Empresa: {svc.companyId} • Horas previstas: {svc.totalHoursPlanned}
        </div>
        <SCurve data={series} />
        <div>
          <div className="font-medium">Histórico</div>
          <ServiceTimeline items={updates.map(u => ({
            date: u.createdAt.toLocaleDateString(), progress: u.progress, note: u.note
          }))} />
        </div>
      </div>

      {svc.status === "aberto" && (
        <div className="mt-4">
          <div className="font-medium mb-1">Nova atualização</div>
          <ServiceUpdateForm lastProgress={lastProgress} onSubmit={onSaveUpdate} />
        </div>
      )}
    </div>
  );
}
