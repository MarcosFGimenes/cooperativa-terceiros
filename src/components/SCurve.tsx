"use client";

import { useMemo } from "react";

type CurvePoint = { date: string; percent: number };

type Props = {
  planned: CurvePoint[];
  realized?: number;
};

export default function SCurve({ planned, realized = 0 }: Props) {
  const max = 100;

  const lastPlanned = useMemo(() => {
    if (!planned.length) return 0;
    return planned[planned.length - 1]?.percent ?? 0;
  }, [planned]);

  const plannedLabel = planned.length
    ? `Planejado (até hoje): ${Math.min(max, Math.max(0, lastPlanned))}%`
    : "Planejado: sem dados";

  return (
    <div className="card space-y-3 p-4">
      <h3 className="text-base font-semibold">Curva S</h3>
      <div className="space-y-3">
        <div className="text-xs text-muted-foreground">{plannedLabel}</div>
        <div className="h-3 w-full rounded bg-muted">
          <div
            className="h-3 rounded bg-primary transition-all"
            style={{ width: `${Math.min(max, Math.max(0, lastPlanned))}%` }}
          />
        </div>
        <div className="text-xs text-muted-foreground">Realizado: {Math.min(max, Math.max(0, realized))}%</div>
        <div className="h-3 w-full rounded bg-muted">
          <div
            className="h-3 rounded bg-emerald-500 transition-all"
            style={{ width: `${Math.min(max, Math.max(0, realized))}%` }}
          />
        </div>
      </div>
    </div>
  );
}
