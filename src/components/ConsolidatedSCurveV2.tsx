"use client";

import SCurveDeferred from "@/components/SCurveDeferred";

export type ConsolidatedSeriesPoint = { date: string; percent: number };

export type ConsolidatedSCurveV2Props = {
  plannedSeries: ConsolidatedSeriesPoint[];
  realizedSeries: ConsolidatedSeriesPoint[];
  realizedPercent?: number;
  title?: string;
  description?: string;
  chartHeight?: number;
  className?: string;
};

export default function ConsolidatedSCurveV2({
  plannedSeries,
  realizedSeries,
  realizedPercent = 0,
  title = "Curva S consolidada",
  description = "Evolução planejada versus realizado para o pacote.",
  chartHeight = 280,
  className,
}: ConsolidatedSCurveV2Props) {
  return (
    <SCurveDeferred
      planned={plannedSeries}
      realizedSeries={realizedSeries}
      realizedPercent={realizedPercent}
      title={title}
      description={description}
      showMetrics={false}
      chartHeight={chartHeight}
      deferRendering
      className={className}
      fallback={
        <div
          className="flex w-full items-center justify-center rounded-xl border border-dashed bg-muted/40"
          style={{ minHeight: chartHeight }}
        >
          <span className="text-sm text-muted-foreground">Carregando gráfico...</span>
        </div>
      }
    />
  );
}
