import { cn } from "@/lib/utils";

type CurveIndicatorsProps = {
  plannedTotal: number;
  plannedToDate: number;
  realized: number;
  delta: number;
  wrapperClassName?: string;
  cardClassName?: string;
  labelClassName?: string;
  valueClassName?: string;
  realizedValueClassName?: string;
  deltaValueClassName?: string;
};

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

export function CurveIndicators({
  plannedTotal,
  plannedToDate,
  realized,
  delta,
  wrapperClassName,
  cardClassName,
  labelClassName,
  valueClassName,
  realizedValueClassName,
  deltaValueClassName,
}: CurveIndicatorsProps) {
  const resolvedDeltaClass =
    deltaValueClassName ??
    (delta < -2
      ? "text-amber-600 dark:text-amber-400"
      : delta > 2
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-foreground");

  const cards = [
    {
      key: "planned-total",
      label: "Planejado (total)",
      value: formatPercent(plannedTotal),
      valueClassName,
    },
    {
      key: "planned-to-date",
      label: "Planejado até hoje",
      value: formatPercent(plannedToDate),
      valueClassName,
    },
    {
      key: "realized",
      label: "Realizado",
      value: formatPercent(realized),
      valueClassName: cn(valueClassName, realizedValueClassName ?? "text-emerald-600 dark:text-emerald-400"),
    },
    {
      key: "delta",
      label: "Diferença",
      value: `${delta > 0 ? "+" : ""}${Math.round(delta)}%`,
      valueClassName: cn(valueClassName, resolvedDeltaClass),
    },
  ];

  return (
    <div className={cn("indicadores-curva", wrapperClassName)}>
      {cards.map((card) => (
        <div
          key={card.key}
          className={cn("indicador-curva flex flex-col gap-1 rounded-xl border bg-muted/30 px-3 py-2.5", cardClassName)}
        >
          <span className={cn("label text-muted-foreground text-sm", labelClassName)}>{card.label}</span>
          <span className={cn("value text-lg font-semibold text-foreground", card.valueClassName)}>{card.value}</span>
        </div>
      ))}
    </div>
  );
}

export default CurveIndicators;
