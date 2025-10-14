"use client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

type SCurveDatum = {
  date: string;
  planned?: number;
  realized?: number;
};

export default function SCurve({ data }:{ data: SCurveDatum[] }) {
  return (
    <div className="h-80 w-full rounded-lg border p-3 bg-white">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 20, left: 5, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tickMargin={6} />
          <YAxis domain={[0,100]} unit="%" tickMargin={6} />
          <Tooltip formatter={(v)=>`${v}%`} labelFormatter={(l)=>`Dia ${l}`} />
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
    </div>
  );
}
