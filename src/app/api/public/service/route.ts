import { NextResponse } from "next/server";

import { PublicAccessError, fetchServiceChecklist, requireServiceAccess } from "@/lib/public-access";
import { listUpdates } from "@/lib/repo/services";

const HISTORY_LIMIT = 20;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const serviceId = searchParams.get("serviceId") ?? "";
  const token = searchParams.get("token") ?? "";

  try {
    const { service } = await requireServiceAccess(token, serviceId);
    const [checklist, updates] = await Promise.all([
      service.hasChecklist ? fetchServiceChecklist(service.id) : Promise.resolve([]),
      listUpdates(service.id, HISTORY_LIMIT),
    ]);

    return NextResponse.json(
      {
        ok: true,
        service,
        checklist,
        updates,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err: unknown) {
    if (err instanceof PublicAccessError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }

    console.error("[api/public/service] Falha inesperada", err);
    return NextResponse.json({ ok: false, error: "Erro interno" }, { status: 500 });
  }
}
