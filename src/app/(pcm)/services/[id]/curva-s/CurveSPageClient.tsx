"use client";

import { toCsv } from "@/lib/curvaSShared";
import SCurveDeferred from "@/components/SCurveDeferred";

type CombinedPoint = { date: string; planned: number; actual: number };

type CurveSPageClientProps = {
  serviceId: string;
  serviceName: string;
  periodLabel: string;
  combined: CombinedPoint[];
};

export default function CurveSPageClient({ serviceId, serviceName, periodLabel, combined }: CurveSPageClientProps) {
  const hasData = combined.length > 0;

  const planned = combined.map((point) => ({ date: point.date, percent: point.planned }));
  const realizedSeries = combined.map((point) => ({ date: point.date, percent: point.actual }));
  const realizedPercent = combined.length ? combined[combined.length - 1].actual : 0;
  const plannedToDate = combined.length ? combined[combined.length - 1].planned : 0;

  const downloadCsv = () => {
    if (!hasData) return;
    const rows = combined.map((r) => ({ date: r.date, planned: r.planned, actual: r.actual }));
    const csv = toCsv(rows);
    if (!csv) return;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `curva-s-${serviceId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container-page space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Curva S</h1>
        <p className="text-sm text-muted-foreground">
          {serviceName}
          {periodLabel ? ` · Período: ${periodLabel}` : null}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 p-4 text-sm">
        <div className="space-y-1">
          <p className="font-medium text-foreground">{serviceName}</p>
          {periodLabel ? <p className="text-muted-foreground">Período planejado: {periodLabel}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-outline h-11 px-5" onClick={downloadCsv} disabled={!hasData}>
            Baixar CSV
          </button>
          <button type="button" className="btn btn-secondary h-11 px-5" onClick={() => window.print()}>
            Imprimir / PDF
          </button>
        </div>
      </div>

      {hasData ? (
        <section className="rounded-2xl border bg-card/80 p-5 shadow-sm">
          <SCurveDeferred
            planned={planned}
            realizedSeries={realizedSeries}
            realizedPercent={realizedPercent}
            title="Curva S do serviço"
            description="Planejado versus realizado considerando o serviço."
            headerAside={<span className="font-medium text-foreground">Realizado: {Math.round(realizedPercent)}%</span>}
            chartHeight={520}
            metrics={{
              plannedToDate,
              realized: realizedPercent,
              plannedTotal: 100,
              delta: realizedPercent - plannedToDate,
            }}
            fallback={
              <div className="flex h-[520px] w-full items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/20 text-sm text-muted-foreground">
                Carregando gráfico...
              </div>
            }
          />
        </section>
      ) : (
        <div className="flex h-[520px] w-full items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/20 text-sm text-muted-foreground md:h-[600px]">
          Sem dados suficientes para gerar o gráfico.
        </div>
      )}
    </div>
  );
}
