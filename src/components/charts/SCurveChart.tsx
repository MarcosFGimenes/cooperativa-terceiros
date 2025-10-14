"use client";

import { useEffect, useMemo, useState } from "react";
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

const baseClass = "w-full rounded-lg border bg-white p-4 shadow-sm";

export type SCurveChartProps = {
  serviceId: string;
  height?: number;
  className?: string;
  refreshKey?: string | number;
};

type ChartPoint = {
  date: string;
  planned: number;
  realized: number;
};

type ApiResponse =
  | { ok: true; points: ChartPoint[] }
  | { ok: false; error?: string };

function combineClasses(className?: string) {
  return className ? `${baseClass} ${className}` : baseClass;
}

export default function SCurveChart({
  serviceId,
  height = 320,
  className,
  refreshKey,
}: SCurveChartProps) {
  const [data, setData] = useState<ChartPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      if (!serviceId) {
        setData([]);
        setError("Serviço inválido");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/pcm/servicos/${serviceId}/scurve`, {
          cache: "no-store",
        });
        const json = (await response.json().catch(() => ({ ok: false }))) as ApiResponse;

        if (cancelled) return;

        if (!response.ok || !json.ok) {
          const message = !response.ok
            ? `Falha ao carregar curva (${response.status})`
            : "error" in json && json.error
              ? json.error
              : "Falha ao carregar curva";
          setError(message);
          setData([]);
        } else {
          setData(json.points ?? []);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("[SCurveChart] Erro ao buscar dados", err);
        setError("Erro ao carregar dados");
        setData([]);
      } finally {
        if (cancelled) return;
        setIsLoading(false);
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [serviceId, refreshKey]);

  const hasData = data.length > 0;

  const wrapperClass = combineClasses(className);
  const formattedTooltip = useMemo(
    () =>
      new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "UTC",
      }),
    [],
  );

  return (
    <div className={wrapperClass} style={{ height }}>
      {isLoading ? (
        <div className="flex h-full items-center justify-center text-sm text-gray-500">
          Carregando curva...
        </div>
      ) : error ? (
        <div className="flex h-full items-center justify-center text-sm text-red-600">
          {error}
        </div>
      ) : hasData ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 20, left: 5, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickMargin={6} />
            <YAxis domain={[0, 100]} unit="%" tickMargin={6} />
            <Tooltip
              formatter={(value: number | string) => `${value}%`}
              labelFormatter={(label: string) => {
                const date = new Date(`${label}T00:00:00.000Z`);
                if (Number.isNaN(date.getTime())) return label;
                return formattedTooltip.format(date);
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="planned"
              name="Planejado"
              dot={false}
              strokeWidth={2}
              stroke="#6366f1"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="realized"
              name="Realizado"
              dot={false}
              strokeWidth={2}
              stroke="#22c55e"
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-gray-500">
          Sem dados suficientes para gerar o gráfico.
        </div>
      )}
    </div>
  );
}
