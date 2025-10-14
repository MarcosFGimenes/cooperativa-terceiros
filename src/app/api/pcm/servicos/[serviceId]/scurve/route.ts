import { NextResponse } from "next/server";

import { getService } from "@/lib/repo/services";
import { mergeToSCurve, plannedSeries, realizedSeries } from "@/lib/scurve";

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

    const planned = plannedSeries(service);
    const realized = await realizedSeries(serviceId);
    const merged = mergeToSCurve(planned, realized);

    const points = merged.labels.map((date, index) => ({
      date,
      planned: merged.planned[index] ?? 0,
      realized: merged.realized[index] ?? 0,
    }));

    return NextResponse.json(
      { ok: true, points },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[api/pcm/servicos/scurve] Falha ao gerar curva", error);
    return NextResponse.json({ ok: false, error: "Erro interno" }, { status: 500 });
  }
}
