import type { CSSProperties } from "react";

type CurvePoint = { d: string; pct: number };

type CurvaSProps = {
  planned: CurvePoint[];
  actual: CurvePoint[];
};

const clampPercent = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
};

const roundTwo = (value: number) => Math.round(value * 100) / 100;

const UTC_TIME_ZONE = "UTC";

const getDateLabel = (iso: string) => {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: UTC_TIME_ZONE,
  }).format(date);
};

const getLongDateLabel = (iso: string) => {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: UTC_TIME_ZONE,
  }).format(date);
};

type SeriesData = {
  path: string;
  points: Array<{ x: number; y: number; value: number; label: string }>;
};

const computeSeries = (
  points: CurvePoint[],
  xPositions: Map<string, number>,
  yForPercent: (value: number) => number,
): SeriesData => {
  const sorted = [...points].sort((a, b) => a.d.localeCompare(b.d));
  const coords = sorted
    .map((point) => {
      const x = xPositions.get(point.d);
      if (typeof x !== "number") return null;
      const pct = clampPercent(point.pct);
      return {
        x,
        y: yForPercent(pct),
        value: roundTwo(pct),
        label: point.d,
      };
    })
    .filter((point): point is NonNullable<typeof point> => Boolean(point));

  const path = coords
    .map((coord, index) => `${index === 0 ? "M" : "L"}${coord.x} ${coord.y}`)
    .join(" ");

  return { path, points: coords };
};

export default function CurvaS({ planned, actual }: CurvaSProps) {
  const hasData = planned.length > 0 || actual.length > 0;

  if (!hasData) {
    return (
      <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-dashed border-muted-foreground/40 bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">
        Sem dados suficientes para gerar o gráfico.
      </div>
    );
  }

  const datesSet = new Set<string>();
  planned.forEach((point) => datesSet.add(point.d));
  actual.forEach((point) => datesSet.add(point.d));

  const dates = Array.from(datesSet).sort((a, b) => a.localeCompare(b));
  if (!dates.length) {
    return (
      <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-dashed border-muted-foreground/40 bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">
        Sem dados suficientes para gerar o gráfico.
      </div>
    );
  }

  const width = 720;
  const height = 360;
  const padding = { top: 24, right: 32, bottom: 56, left: 64 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const xPositions = new Map<string, number>();
  dates.forEach((date, index) => {
    const x =
      dates.length > 1
        ? padding.left + (index / (dates.length - 1)) * plotWidth
        : padding.left + plotWidth / 2;
    xPositions.set(date, x);
  });

  const yForPercent = (value: number) =>
    padding.top + ((100 - clampPercent(value)) / 100) * plotHeight;

  const plannedSeries = computeSeries(planned, xPositions, yForPercent);
  const actualSeries = computeSeries(actual, xPositions, yForPercent);

  const percentTicks = [0, 25, 50, 75, 100];
  const showXAxisLabels = dates.length <= 8 ? dates : dates.filter((_, index) => index % 2 === 0);

  const legendItems: Array<{ label: string; color: string; dash?: string }> = [
    { label: "Planejado", color: "#6366f1", dash: "6 4" },
    { label: "Realizado", color: "#16a34a" },
  ];

  return (
    <div className="space-y-4">
      <svg
        role="img"
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        style={{ maxWidth: "100%" } as CSSProperties}
        aria-label="Curva S planejado versus realizado"
      >
        <rect
          x={padding.left}
          y={padding.top}
          width={plotWidth}
          height={plotHeight}
          fill="url(#curva-grid)"
          stroke="#d1d5db"
          strokeWidth={1}
        />

        <defs>
          <pattern id="curva-grid" width="100" height="100" patternUnits="userSpaceOnUse">
            <rect width="100" height="100" fill="transparent" />
            <path d="M0 100H100" stroke="#e5e7eb" strokeWidth="1" />
            <path d="M100 0V100" stroke="#e5e7eb" strokeWidth="1" />
          </pattern>
        </defs>

        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={padding.top + plotHeight}
          stroke="#111827"
          strokeWidth={1.5}
        />
        <line
          x1={padding.left}
          y1={padding.top + plotHeight}
          x2={padding.left + plotWidth}
          y2={padding.top + plotHeight}
          stroke="#111827"
          strokeWidth={1.5}
        />

        {percentTicks.map((tick) => {
          const y = yForPercent(tick);
          return (
            <g key={tick}>
              <line
                x1={padding.left}
                x2={padding.left + plotWidth}
                y1={y}
                y2={y}
                stroke="#e5e7eb"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <text
                x={padding.left - 12}
                y={y + 4}
                textAnchor="end"
                fontSize={12}
                fill="#4b5563"
              >
                {tick}%
              </text>
            </g>
          );
        })}

        {showXAxisLabels.map((date) => {
          const x = xPositions.get(date);
          if (typeof x !== "number") return null;
          return (
            <text
              key={date}
              x={x}
              y={padding.top + plotHeight + 24}
              textAnchor="middle"
              fontSize={12}
              fill="#4b5563"
            >
              {getDateLabel(date)}
            </text>
          );
        })}

        {plannedSeries.path && (
          <path
            d={plannedSeries.path}
            fill="none"
            stroke="#6366f1"
            strokeWidth={2.5}
            strokeDasharray="6 4"
            strokeLinecap="round"
          />
        )}

        {actualSeries.path && (
          <path
            d={actualSeries.path}
            fill="none"
            stroke="#16a34a"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        )}

        {[plannedSeries, actualSeries].map((series, seriesIndex) =>
          series.points.map((point, pointIndex) => (
            <g key={`${seriesIndex}-${point.label}-${pointIndex}`}>
              <circle cx={point.x} cy={point.y} r={4.5} fill="#fff" strokeWidth={2.5} stroke="#111827" />
              <title>{`${getLongDateLabel(point.label)}: ${point.value}%`}</title>
            </g>
          )),
        )}
      </svg>

      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        {legendItems.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span
              className="h-2 w-4 rounded-sm"
              style={{
                background:
                  item.dash && item.dash.length > 0
                    ? `repeating-linear-gradient(90deg, transparent, transparent 4px, ${item.color} 4px, ${item.color} 8px)`
                    : item.color,
              }}
            />
            <span className="font-medium text-foreground">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
