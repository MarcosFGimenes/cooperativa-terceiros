import { NextResponse } from "next/server";

import { curvaPlanejada, curvaRealizada } from "@/lib/curvaS";
import { getService } from "@/lib/repo/services";

const parseISODate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const clampPercent = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
};

export async function GET(
  _req: Request,
  context: { params: Promise<{ serviceId: string }> },
): Promise<NextResponse> {
  const { serviceId } = await context.params;

  if (!serviceId) {
    return NextResponse.json({ ok: false, error: "serviceId ausente" }, { status: 400 });
  }

  try {
    const service = await getService(serviceId);
    if (!service) {
      return NextResponse.json({ ok: false, error: "Serviço não encontrado" }, { status: 404 });
    }

    const inicio = parseISODate(service.plannedStart);
    const fim = parseISODate(service.plannedEnd);

    const planned = inicio || fim
      ? curvaPlanejada(inicio ?? fim ?? new Date(), fim ?? inicio ?? new Date(), service.totalHours ?? 0)
      : [];
    const actual = await curvaRealizada(serviceId);

    const plannedMap = new Map(planned.map((point) => [point.d, point.pct]));
    const actualMap = new Map(actual.map((point) => [point.d, point.pct]));

    const labels = Array.from(new Set([...plannedMap.keys(), ...actualMap.keys()]));
    labels.sort((a, b) => a.localeCompare(b));

    let plannedAccumulator = 0;
    let actualAccumulator = 0;

    const points = labels.map((date) => {
      if (plannedMap.has(date)) {
        plannedAccumulator = Math.max(plannedAccumulator, clampPercent(plannedMap.get(date) ?? 0));
      }
      if (actualMap.has(date)) {
        actualAccumulator = Math.max(actualAccumulator, clampPercent(actualMap.get(date) ?? 0));
      }
      return {
        date,
        planned: plannedAccumulator,
        realized: actualAccumulator,
      };
    });

    return NextResponse.json(
      { ok: true, points },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[api/pcm/servicos/scurve] Falha ao gerar curva", error);
    return NextResponse.json({ ok: false, error: "Erro interno" }, { status: 500 });
  }
}
