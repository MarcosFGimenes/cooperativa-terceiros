"use client";

import { useEffect, useMemo, useState } from "react";
import type { TooltipProps } from "recharts";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type PlannedPoint = { date: string; percent: number; hoursAccum?: number };
type CurvePoint = { date: string; percent: number };

type Props = {
  planned: PlannedPoint[];
  realizedSeries: CurvePoint[];
  realizedPercent: number;
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
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" }).format(date);
  } catch (error) {
    console.error("[SCurve] Failed to format date", error);
    return value;
  }
}

function formatFullDate(value: string) {
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);
  } catch {
    return value;
  }
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone?: "neutral" | "positive" | "warning" }) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warning"
        ? "text-amber-600 dark:text-amber-400"
        : "text-foreground";
  return (
    <div className="rounded-xl border border-dashed p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function ChartTooltip({ active, payload }: TooltipPayload) {
  if (!active || !payload || payload.length === 0) return null;

  const first = payload[0]?.payload as ChartEntry | undefined;
  if (!first) return null;

  const planned = payload.find((item) => item.dataKey === "planned");
  const realized = payload.find((item) => item.dataKey === "realized");

  return (
    <div className="rounded-lg border bg-background p-3 text-xs shadow-sm">
      <p className="font-semibold text-foreground">{formatFullDate(first.date)}</p>
      {planned && typeof planned.value === "number" ? (
        <p className="mt-1 text-muted-foreground">
          Planejado: <span className="font-semibold text-foreground">{Math.round(planned.value)}%</span>
        </p>
      ) : null}
      {typeof first.plannedHours === "number" ? (
        <p className="text-muted-foreground">
          Horas acumuladas: <span className="font-semibold text-foreground">{first.plannedHours.toFixed(1)}</span>
        </p>
      ) : null}
      {realized && typeof realized.value === "number" ? (
        <p className="mt-1 text-muted-foreground">
          Realizado: <span className="font-semibold text-foreground">{Math.round(realized.value)}%</span>
        </p>
      ) : null}
    </div>
  );
}

function clampPercent(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return Math.max(0, Math.min(100, value));
}

export default function SCurve({ planned, realizedSeries, realizedPercent }: Props) {
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

    return Array.from(map.values()).sort((a, b) => {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
  }, [planned, realizedSeries]);

  const plannedTotal = useMemo(() => {
    if (!planned.length) return 0;
    const last = planned[planned.length - 1];
    return clampPercent(last?.percent) ?? 0;
  }, [planned]);

  const plannedToToday = useMemo(() => {
    if (!planned.length) return 0;
    const today = new Date();
    const candidates = planned.filter((point) => {
      const date = new Date(point.date);
      if (Number.isNaN(date.getTime())) return false;
      return date.getTime() <= today.getTime();
    });
    if (!candidates.length) return clampPercent(planned[0]?.percent) ?? 0;
    const last = candidates[candidates.length - 1];
    return clampPercent(last?.percent) ?? 0;
  }, [planned]);

  const realisedLatest = useMemo(() => {
    if (realizedSeries.length) {
      const last = realizedSeries[realizedSeries.length - 1];
      return clampPercent(last?.percent) ?? 0;
    }
    return clampPercent(realizedPercent) ?? 0;
  }, [realizedPercent, realizedSeries]);

  const delta = realisedLatest - plannedToToday;
  const deltaTone = delta >= -2 && delta <= 2 ? "neutral" : delta > 2 ? "positive" : "warning";

  const hasData = chartData.some((entry) => entry.planned !== null || entry.realized !== null);
  const [isClientReady, setIsClientReady] = useState(false);

  useEffect(() => {
    setIsClientReady(true);
  }, []);

  return (
    <div className="card space-y-4 p-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold">Curva S</h3>
        <p className="text-xs text-muted-foreground">
          Comparativo entre o avanço planejado e o realizado ao longo do tempo.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Planejado (total)" value={`${Math.round(plannedTotal)}%`} />
        <MetricCard label="Planejado até hoje" value={`${Math.round(plannedToToday)}%`} />
        <MetricCard label="Realizado" value={`${Math.round(realisedLatest)}%`} tone="positive" />
        <MetricCard
          label="Diferença"
          value={`${delta > 0 ? "+" : ""}${Math.round(delta)}%`}
          tone={deltaTone === "positive" ? "positive" : deltaTone === "warning" ? "warning" : "neutral"}
        />
      </div>

      {hasData ? (
        isClientReady ? (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ left: 4, right: 16, top: 16, bottom: 8 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--border))" />
                <XAxis dataKey="dateLabel" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  domain={[0, 100]}
                  allowDecimals={false}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  name="Planejado"
                  dataKey="planned"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  name="Realizado"
                  dataKey="realized"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
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
