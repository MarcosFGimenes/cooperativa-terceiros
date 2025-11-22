import {
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";

import {
  ACTIVE_DOT_RADIUS,
  DOT_RADIUS,
  LINE_STROKE_WIDTH,
  PLANNED_COLOR,
  REALIZED_COLOR,
} from "./charts/colors";

type TooltipPayload = TooltipProps<number, string>;

function CustomTooltip({ active, payload, label }: TooltipPayload) {
  if (!active || !payload || payload.length === 0) return null;

  const planned = payload.find((item) => item.dataKey === "planned");
  const realized = payload.find((item) => item.dataKey === "actual");

  const plannedValue = typeof planned?.value === "number" ? Math.round(planned.value) : null;
  const realizedValue = typeof realized?.value === "number" ? Math.round(realized.value) : null;
  const difference =
    plannedValue !== null && realizedValue !== null ? Math.round(realizedValue - plannedValue) : null;

  return (
    <div className="rounded-md border bg-background p-3 text-xs shadow-sm">
      <p className="font-semibold text-foreground">{label}</p>
      {plannedValue !== null ? (
        <p className="mt-1 text-muted-foreground">
          Planejado: <span className="font-semibold text-foreground">{plannedValue}%</span>
        </p>
      ) : null}
      {realizedValue !== null ? (
        <p className="text-muted-foreground">
          Realizado: <span className="font-semibold text-foreground">{realizedValue}%</span>
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

export default function CurveSChart({ data }: { data: { date: string; planned: number; actual: number }[] }) {
  return (
    <div className="w-full h-[420px]">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 24, right: 24, left: 8, bottom: 8 }}>
          <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" horizontal={false} />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
          <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="planned"
            stroke={PLANNED_COLOR}
            strokeWidth={LINE_STROKE_WIDTH}
            dot={{ r: DOT_RADIUS, stroke: PLANNED_COLOR, fill: PLANNED_COLOR }}
            activeDot={{ r: ACTIVE_DOT_RADIUS, stroke: PLANNED_COLOR, fill: PLANNED_COLOR }}
            name="Planejado"
            strokeLinecap="round"
            isAnimationActive={false}
          >
            <LabelList
              dataKey="planned"
              position="top"
              formatter={(v: number) => `${Math.round(v)}%`}
              className="text-[10px] fill-muted-foreground"
            />
          </Line>
          <Line
            type="monotone"
            dataKey="actual"
            stroke={REALIZED_COLOR}
            strokeWidth={LINE_STROKE_WIDTH}
            dot={{ r: DOT_RADIUS, stroke: REALIZED_COLOR, fill: REALIZED_COLOR }}
            activeDot={{ r: ACTIVE_DOT_RADIUS, stroke: REALIZED_COLOR, fill: REALIZED_COLOR }}
            name="Realizado"
            strokeLinecap="round"
            isAnimationActive={false}
          >
            <LabelList
              dataKey="actual"
              position="top"
              formatter={(v: number) => `${Math.round(v)}%`}
              className="text-[10px] fill-muted-foreground"
            />
          </Line>
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
