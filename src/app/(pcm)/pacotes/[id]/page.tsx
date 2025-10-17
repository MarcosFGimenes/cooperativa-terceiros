"use client";
import RequireAuth from "@/components/RequireAuth";
import PageHeader from "@/components/PageHeader";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getPackage, type Package } from "@/lib/db";

export default function PackageDetailPage({ params }: { params: { id: string } }) {
  const [pkg, setPkg] = useState<Package | null>(null);
  useEffect(() => { (async ()=> setPkg(await getPackage(params.id)))(); }, [params.id]);

  return (
    <RequireAuth>
      <div className="container-page">
        <PageHeader
          title={`Pacote ${pkg?.nome ?? ""}`}
          subtitle="Resumo e Curva S consolidada"
          actions={<Link className="btn-secondary" href="/pacotes">Voltar</Link>}
        />
        {!pkg ? (
          <div className="card text-sm text-muted-foreground">Carregando…</div>
        ) : (
          <div className="card text-sm text-muted-foreground">
            Conteúdo do pacote e Curva S consolidada (placeholder).
          </div>
        )}
      </div>
    </RequireAuth>
  );
}
