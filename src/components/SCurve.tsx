"use client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function SCurve({ data }:{ data: { date: string; progress: number }[] }) {
  return (
    <div className="h-72 w-full rounded-lg border p-3">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 20, left: 5, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tickMargin={6} />
          <YAxis domain={[0,100]} unit="%" tickMargin={6} />
          <Tooltip formatter={(v)=>`${v}%`} labelFormatter={(l)=>`Dia ${l}`} />
          <Line type="monotone" dataKey="progress" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
