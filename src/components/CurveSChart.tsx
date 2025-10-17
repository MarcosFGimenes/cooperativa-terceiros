import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from "recharts";

export default function CurveSChart({ data }: { data: { date: string; planned: number; actual: number }[] }) {
  return (
    <div className="w-full h-[420px]">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 24, right: 24, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
          <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
          <Tooltip formatter={(v: number) => `${v}%`} />
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
