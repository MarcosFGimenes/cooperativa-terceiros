"use client";
import RequireAuth from "@/components/RequireAuth";
import PageHeader from "@/components/PageHeader";

export default function ReportsPage() {
  return (
    <RequireAuth>
      <div className="container-page">
        <PageHeader title="Relatórios" subtitle="Exportação de PDFs e gráficos" />
        <div className="card">
          <button type="button" className="btn-primary">Exportar PDF (em breve)</button>
        </div>
      </div>
    </RequireAuth>
  );
}
