import Link from "next/link";
import { notFound } from "next/navigation";

import CurvaS from "@/components/charts/CurvaS";
import { curvaPlanejada, curvaRealizada } from "@/lib/curvaS";
import { getPackage, listPackageServices } from "@/lib/repo/packages";
import type { Service } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

type CurvePoint = { d: string; pct: number };

type ServiceCurve = {
  service: Service;
  planned: CurvePoint[];
  actual: CurvePoint[];
};

const parseISODate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const roundTwo = (value: number) => Math.round(value * 100) / 100;
const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

const expandValuesForDates = (points: CurvePoint[], dates: string[]): number[] => {
  const sorted = [...points].sort((a, b) => a.d.localeCompare(b.d));
  const values: number[] = [];
  let pointer = 0;
  let latest = 0;

  dates.forEach((date) => {
    while (pointer < sorted.length && sorted[pointer].d.localeCompare(date) <= 0) {
      latest = sorted[pointer].pct;
      pointer += 1;
    }
    values.push(latest);
  });

  return values;
};

const formatDateRange = (services: Service[]) => {
  const starts: Date[] = [];
  const ends: Date[] = [];
  services.forEach((service) => {
    const start = parseISODate(service.plannedStart);
    const end = parseISODate(service.plannedEnd);
    if (start) starts.push(start);
    if (end) ends.push(end);
  });
  if (!starts.length && !ends.length) return "—";
  const min = starts.length ? new Date(Math.min(...starts.map((date) => date.getTime()))) : null;
  const max = ends.length ? new Date(Math.max(...ends.map((date) => date.getTime()))) : null;
  const format = (date: Date | null) => {
    if (!date) return "—";
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  };
  if (!min) return format(max);
  if (!max) return format(min);
  if (min.getTime() === max.getTime()) return format(min);
  return `${format(min)} até ${format(max)}`;
};

const unionDates = (curves: ServiceCurve[]) => {
  const set = new Set<string>();
  curves.forEach(({ planned, actual }) => {
    planned.forEach((point) => set.add(point.d));
    actual.forEach((point) => set.add(point.d));
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b));
};

export default async function PackageDetailPage({ params }: Params) {
  const { id } = params;

  const [pkg, services] = await Promise.all([getPackage(id), listPackageServices(id)]);
  if (!pkg) {
    notFound();
  }

  const curves: ServiceCurve[] = await Promise.all(
    services.map(async (service) => {
      const start = parseISODate(service.plannedStart);
      const end = parseISODate(service.plannedEnd);
      const planned = start || end
        ? curvaPlanejada(start ?? end ?? new Date(), end ?? start ?? new Date(), service.totalHours ?? 0)
        : [];
      const actual = await curvaRealizada(service.id);
      return { service, planned, actual };
    }),
  );

  const dates = unionDates(curves);

  const weights = curves.map(({ service }) => {
    const hours = typeof service.totalHours === "number" && service.totalHours > 0 ? service.totalHours : 1;
    return hours;
  });
  const totalWeight = weights.reduce((acc, weight) => acc + weight, 0);

  const plannedValues = curves.map(({ planned }) => expandValuesForDates(planned, dates));
  const actualValues = curves.map(({ actual }) => expandValuesForDates(actual, dates));

  const aggregatedPlanned = dates.map((date, index) => {
    if (!totalWeight) return { d: date, pct: 0 };
    const sum = plannedValues.reduce((acc, values, idx) => acc + values[index] * weights[idx], 0);
    const average = sum / totalWeight;
    return { d: date, pct: roundTwo(clampPercent(average)) };
  });

  const aggregatedActual = dates.map((date, index) => {
    if (!totalWeight) return { d: date, pct: 0 };
    const sum = actualValues.reduce((acc, values, idx) => acc + values[index] * weights[idx], 0);
    const average = sum / totalWeight;
    return { d: date, pct: roundTwo(clampPercent(average)) };
  });

  const averageProgress = aggregatedActual.length ? aggregatedActual[aggregatedActual.length - 1].pct : 0;
  const totalHours = totalWeight;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{pkg.name || `Pacote ${pkg.id}`}</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe a Curva S consolidada dos serviços associados a este pacote.
          </p>
        </div>
        <Link className="btn-secondary" href="/pacotes">
          Voltar
        </Link>
      </div>

      <section className="card space-y-6 p-6">
        <div className="grid gap-4 rounded-lg border border-border/70 bg-muted/30 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Serviços</span>
            <p className="mt-1 text-base font-semibold text-foreground">{services.length}</p>
            <p className="text-xs text-muted-foreground">Quantidade de serviços vinculados.</p>
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Andamento médio</span>
            <p className="mt-1 text-base font-semibold text-foreground">{averageProgress.toFixed(2)}%</p>
            <p className="text-xs text-muted-foreground">Último consolidado do pacote.</p>
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Horas acumuladas</span>
            <p className="mt-1 text-base font-semibold text-foreground">{totalHours.toFixed(0)} h</p>
            <p className="text-xs text-muted-foreground">Soma ponderada das horas planejadas.</p>
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Período planejado</span>
            <p className="mt-1 text-base font-semibold text-foreground">{formatDateRange(services)}</p>
            <p className="text-xs text-muted-foreground">Janela resultante dos serviços.</p>
          </div>
        </div>

        <CurvaS planned={aggregatedPlanned} actual={aggregatedActual} />

        {services.length === 0 && (
          <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
            Nenhum serviço vinculado a este pacote ainda.
          </div>
        )}
      </section>
    </div>
  );
}
