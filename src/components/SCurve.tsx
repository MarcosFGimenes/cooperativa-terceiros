"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { TooltipProps } from "recharts";
import {
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  CartesianGrid,
  YAxis,
} from "recharts";

import { cn } from "@/lib/utils";
import { formatLongDate, formatShortMonthDate } from "@/lib/formatDateTime";
import {
  ACTIVE_DOT_RADIUS,
  DOT_RADIUS,
  LINE_STROKE_WIDTH,
  PLANNED_COLOR,
  REALIZED_COLOR,
} from "./charts/colors";

type PlannedPoint = { date: string; percent: number; hoursAccum?: number };
type CurvePoint = { date: string; percent: number };

type SCurveMetrics = {
  plannedTotal?: number | null;
  plannedToDate?: number | null;
  realized?: number | null;
  delta?: number | null;
};

export type SCurveProps = {
  planned: PlannedPoint[];
  realizedSeries: CurvePoint[];
  realizedPercent: number;
  title?: string;
  description?: string;
  headerAside?: ReactNode;
  className?: string;
  chartHeight?: number;
  deferRendering?: boolean;
  metrics?: SCurveMetrics;
  showMetrics?: boolean;
  showHeader?: boolean;
  unstyled?: boolean;
};

type ChartEntry = {
  date: string;
  dateLabel: string;
  planned: number | null;
  realized: number | null;
  plannedHours: number | null;
};

type TooltipPayload = TooltipProps<number, string>;

function toDayIso(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatShortDate(value: string) {
  return formatShortMonthDate(value, { timeZone: "UTC", fallback: value }) || value;
}

function formatFullDate(value: string) {
  return formatLongDate(value, { timeZone: "UTC", fallback: value }) || value;
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone?: "neutral" | "positive" | "warning" }) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warning"
        ? "text-amber-600 dark:text-amber-400"
        : "text-foreground";
  return (
    <div className="rounded-lg border border-dashed bg-background/60 p-2 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-base font-semibold leading-tight ${toneClass}`}>{value}</p>
    </div>
  );
}

function ChartTooltip({ active, payload }: TooltipPayload) {
  if (!active || !payload || payload.length === 0) return null;

  const first = payload[0]?.payload as ChartEntry | undefined;
  if (!first) return null;

  const planned = payload.find((item) => item.dataKey === "planned");
  const realized = payload.find((item) => item.dataKey === "realized");

  const plannedValue = typeof planned?.value === "number" ? planned.value : null;
  const realizedValue = typeof realized?.value === "number" ? realized.value : null;
  const difference =
    plannedValue !== null && realizedValue !== null
      ? Math.round(realizedValue - plannedValue)
      : null;

  return (
    <div className="rounded-lg border bg-background p-3 text-xs shadow-sm">
      <p className="font-semibold text-foreground">{formatFullDate(first.date)}</p>
      {plannedValue !== null ? (
        <p className="mt-1 text-muted-foreground">
          Planejado: <span className="font-semibold text-foreground">{Math.round(plannedValue)}%</span>
        </p>
      ) : null}
      {typeof first.plannedHours === "number" ? (
        <p className="text-muted-foreground">
          Horas acumuladas: <span className="font-semibold text-foreground">{first.plannedHours.toFixed(1)}</span>
        </p>
      ) : null}
      {realizedValue !== null ? (
        <p className="mt-1 text-muted-foreground">
          Realizado: <span className="font-semibold text-foreground">{Math.round(realizedValue)}%</span>
        </p>
      ) : null}
      {difference !== null ? (
        <p className="text-muted-foreground">
          Diferença: <span className="font-semibold text-foreground">{difference > 0 ? "+" : ""}{difference}%</span>
        </p>
      ) : null}
    </div>
  );
}

function clampPercent(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return Math.max(0, Math.min(100, value));
}

export default function SCurve({
  planned,
  realizedSeries,
  realizedPercent,
  title,
  description,
  headerAside,
  className,
  chartHeight,
  deferRendering = false,
  metrics,
  showMetrics = true,
  showHeader = true,
  unstyled = false,
}: SCurveProps) {
  const chartData = useMemo<ChartEntry[]>(() => {
    const map = new Map<string, ChartEntry>();

    const upsert = (date: string) => {
      const key = toDayIso(date);
      const existing = map.get(key);
      if (existing) return existing;
      const entry: ChartEntry = {
        date: key,
        dateLabel: formatShortDate(key),
        planned: null,
        realized: null,
        plannedHours: null,
      };
      map.set(key, entry);
      return entry;
    };

    planned.forEach((point) => {
      if (!point?.date) return;
      const entry = upsert(point.date);
      entry.planned = clampPercent(point.percent);
      entry.plannedHours = typeof point.hoursAccum === "number" ? point.hoursAccum : entry.plannedHours;
    });

    realizedSeries.forEach((point) => {
      if (!point?.date) return;
      const entry = upsert(point.date);
      entry.realized = clampPercent(point.percent);
    });

    const sorted = Array.from(map.values()).sort((a, b) => {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    // Atualizar o último ponto com valor realized para usar realizedPercent
    if (typeof realizedPercent === "number" && Number.isFinite(realizedPercent)) {
      for (let i = sorted.length - 1; i >= 0; i--) {
        if (sorted[i].realized !== null) {
          sorted[i].realized = clampPercent(realizedPercent);
          break;
        }
      }
    }

    return sorted;
  }, [planned, realizedSeries, realizedPercent]);

  const plannedTotal = useMemo(() => {
    const indicator = clampPercent(metrics?.plannedTotal);
    if (indicator !== null) {
      return indicator;
    }
    if (!planned.length) return 0;
    const last = planned[planned.length - 1];
    return clampPercent(last?.percent) ?? 0;
  }, [metrics?.plannedTotal, planned]);

  const plannedToToday = useMemo(() => {
    const indicator = clampPercent(metrics?.plannedToDate);
    if (indicator !== null) {
      return Math.round(indicator);
    }
    if (!planned.length) return 0;
    const today = new Date();
    const candidates = planned.filter((point) => {
      const date = new Date(point.date);
      if (Number.isNaN(date.getTime())) return false;
      return date.getTime() <= today.getTime();
    });
    if (!candidates.length) {
      const value = clampPercent(planned[0]?.percent) ?? 0;
      return Math.round(value);
    }
    const last = candidates[candidates.length - 1];
    const value = clampPercent(last?.percent) ?? 0;
    return Math.round(value);
  }, [metrics?.plannedToDate, planned]);

  const realisedLatest = useMemo(() => {
    const indicator = clampPercent(metrics?.realized);
    if (indicator !== null) {
      return indicator;
    }
    if (realizedSeries.length) {
      const last = realizedSeries[realizedSeries.length - 1];
      return clampPercent(last?.percent) ?? 0;
    }
    return clampPercent(realizedPercent) ?? 0;
  }, [metrics?.realized, realizedPercent, realizedSeries]);

  const delta = useMemo(() => {
    if (typeof metrics?.delta === "number" && Number.isFinite(metrics.delta)) {
      return metrics.delta;
    }
    return realisedLatest - plannedToToday;
  }, [metrics?.delta, plannedToToday, realisedLatest]);
  const deltaTone = delta >= -2 && delta <= 2 ? "neutral" : delta > 2 ? "positive" : "warning";

  const hasData = chartData.some((entry) => entry.planned !== null || entry.realized !== null);
  const [isClientReady, setIsClientReady] = useState(false);

  useEffect(() => {
    setIsClientReady(true);
  }, []);


  const resolvedTitle = title ?? "Curva S";
  const resolvedDescription =
    description ?? "Comparativo entre o avanço planejado e o realizado ao longo do tempo.";
  const resolvedChartHeight = chartHeight && Number.isFinite(chartHeight) && chartHeight > 0 ? chartHeight : 288;
  const containerClassName = cn(unstyled ? "space-y-4" : "card space-y-4 p-4", className);
  const axisColor = "hsl(var(--foreground))";
  const gridColor = "hsl(var(--muted-foreground))";

  return (
    <div className={containerClassName}>
      {showHeader ? (
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <h3 className="truncate text-base font-semibold">{resolvedTitle}</h3>
            <p className="text-xs text-muted-foreground">{resolvedDescription}</p>
          </div>
          {headerAside ? <div className="text-xs text-muted-foreground">{headerAside}</div> : null}
        </div>
      ) : null}

      {showMetrics ? (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Planejado (total)" value={`${Math.round(plannedTotal)}%`} />
          <MetricCard label="Planejado até hoje" value={`${plannedToToday}%`} />
          <MetricCard label="Realizado" value={`${Math.round(realisedLatest)}%`} tone="positive" />
          <MetricCard
            label="Diferença"
            value={`${delta > 0 ? "+" : ""}${Math.round(delta)}%`}
            tone={deltaTone === "positive" ? "positive" : deltaTone === "warning" ? "warning" : "neutral"}
          />
        </div>
      ) : null}

      {hasData ? (
        isClientReady ? (
          <div className={cn("w-full scurve-container")} style={{ height: resolvedChartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ left: 44, right: 16, top: 16, bottom: 12 }}
                style={{ background: "transparent" }}
              >
                <CartesianGrid stroke={gridColor} vertical horizontal strokeOpacity={0.4} />
                <XAxis
                  dataKey="dateLabel"
                  stroke={axisColor}
                  tick={{ fontSize: 12, fill: axisColor }}
                  tickLine={{ stroke: axisColor, strokeWidth: 1.25 }}
                  axisLine={{ stroke: axisColor, strokeWidth: 1.5 }}
                />
                <YAxis
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  tick={{ fontSize: 11, fill: axisColor }}
                  width={38}
                  stroke={axisColor}
                  tickLine={{ stroke: axisColor, strokeWidth: 1.25 }}
                  axisLine={{ stroke: axisColor, strokeWidth: 1.5 }}
                  tickMargin={4}
                  allowDecimals={false}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: axisColor }} />
                <Line
                  type="monotone"
                  name="Planejado"
                  dataKey="planned"
                  stroke={PLANNED_COLOR} // cor da série Planejado alinhada ao modelo João
                  strokeWidth={LINE_STROKE_WIDTH}
                  dot={{ r: DOT_RADIUS, stroke: PLANNED_COLOR, fill: PLANNED_COLOR }}
                  activeDot={{ r: ACTIVE_DOT_RADIUS, stroke: PLANNED_COLOR, fill: PLANNED_COLOR }}
                  strokeLinecap="round"
                  isAnimationActive={false}
                >
                  <LabelList
                    dataKey="planned"
                    position="top"
                    formatter={(value) => (typeof value === "number" ? `${Math.round(value)}%` : "")}
                    className="text-[11px] font-semibold drop-shadow-sm"
                    fill={axisColor}
                  />
                </Line>
                <Line
                  type="monotone"
                  name="Realizado"
                  dataKey="realized"
                  stroke={REALIZED_COLOR} // cor da série Realizado alinhada ao modelo João
                  strokeWidth={LINE_STROKE_WIDTH}
                  dot={{ r: DOT_RADIUS, stroke: REALIZED_COLOR, fill: REALIZED_COLOR }}
                  activeDot={{ r: ACTIVE_DOT_RADIUS, stroke: REALIZED_COLOR, fill: REALIZED_COLOR }}
                  strokeLinecap="round"
                  isAnimationActive={false}
                >
                  <LabelList
                    dataKey="realized"
                    position="top"
                    formatter={(value) => (typeof value === "number" ? `${Math.round(value)}%` : "")}
                    className="text-[11px] font-semibold drop-shadow-sm"
                    fill={axisColor}
                  />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-72 w-full items-center justify-center rounded-xl border border-dashed border-muted-foreground/40 bg-muted/20 text-xs text-muted-foreground">
            Preparando gráfico…
          </div>
        )
      ) : (
        <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
          Dados insuficientes para montar a curva S.
        </div>
      )}
    </div>
  );
}
