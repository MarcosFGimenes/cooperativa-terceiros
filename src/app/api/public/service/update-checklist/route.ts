import { NextResponse } from "next/server";

import { PublicAccessError, requireServiceAccess } from "@/lib/public-access";
import { addComputedUpdate, updateChecklistProgress } from "@/lib/repo/services";

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const serviceId = searchParams.get("serviceId") ?? "";
  const token = searchParams.get("token") ?? "";

  try {
    const { service } = await requireServiceAccess(token, serviceId);
    if (!service.hasChecklist) {
      throw new PublicAccessError(400, "Serviço não possui checklist");
    }

    const body = (await req.json().catch(() => ({}))) as {
      updates?: Array<{ id?: unknown; progress?: unknown; status?: unknown }>;
      note?: unknown;
    };

    if (!Array.isArray(body.updates)) {
      throw new PublicAccessError(400, "updates deve ser um array");
    }

    const updates = body.updates.map((item) => {
      const id = typeof item.id === "string" ? item.id : null;
      const progress = Number(item.progress);
      const status = typeof item.status === "string" ? item.status : undefined;
      if (!id || !Number.isFinite(progress)) {
        throw new PublicAccessError(400, "updates inválidos");
      }
      return { id, progress, status };
    });

    const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : undefined;

    const realPercent = await updateChecklistProgress(service.id, updates);
    await addComputedUpdate(service.id, realPercent, note, token);

    return NextResponse.json({ ok: true, realPercent });
  } catch (err: unknown) {
    if (err instanceof PublicAccessError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }

    console.error("[api/public/service/update-checklist] Falha inesperada", err);
    return NextResponse.json({ ok: false, error: "Erro interno" }, { status: 500 });
  }
}
