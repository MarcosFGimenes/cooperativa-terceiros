"use client";
import RequireAuth from "@/components/RequireAuth";
import PageHeader from "@/components/PageHeader";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getService, type Service } from "@/lib/db";

export default function ServiceDetailPage({ params }: { params: { id: string } }) {
  const [svc, setSvc] = useState<Service | null>(null);
  useEffect(() => { (async ()=> setSvc(await getService(params.id)))(); }, [params.id]);

  return (
    <RequireAuth>
      <div className="container-page">
        <PageHeader
          title={`Serviço ${svc?.os ?? ""}`}
          subtitle="Resumo, checklist, Curva S e histórico"
          actions={<Link className="btn-secondary" href="/servicos">Voltar</Link>}
        />
        {!svc ? (
          <div className="card text-sm text-muted-foreground">Carregando…</div>
        ) : (
          <div className="grid gap-4">
            <div className="card grid gap-1">
              <div><span className="text-muted-foreground">Equipamento:</span> {svc.equipamento ?? "-"}</div>
              <div><span className="text-muted-foreground">Setor:</span> {svc.setor ?? "-"}</div>
              <div><span className="text-muted-foreground">Status:</span> {svc.status ?? "-"}</div>
              <div><span className="text-muted-foreground">Andamento:</span> {typeof svc.andamento === "number" ? `${svc.andamento}%` : "-"}</div>
            </div>
            <div className="card text-sm text-muted-foreground">
              Curva S: cálculo/visual será implementado na tarefa específica (placeholder).
            </div>
          </div>
        )}
      </div>
    </RequireAuth>
  );
}
