import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  type TooltipProps,
} from "recharts";

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
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
          <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
          <Tooltip content={<CustomTooltip />} />
          <Line type="monotone" dataKey="planned" stroke="#f59e0b" strokeWidth={3} dot={{ r: 2 }} activeDot={{ r: 4 }} name="Planejado">
            <LabelList
              dataKey="planned"
              position="top"
              formatter={(v: number) => `${v}%`}
              className="text-[10px] fill-muted-foreground"
            />
          </Line>
          <Line type="monotone" dataKey="actual" stroke="#2563eb" strokeWidth={3} dot={{ r: 2 }} activeDot={{ r: 4 }} name="Realizado">
            <LabelList
              dataKey="actual"
              position="top"
              formatter={(v: number) => `${v}%`}
              className="text-[10px] fill-muted-foreground"
            />
          </Line>
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
