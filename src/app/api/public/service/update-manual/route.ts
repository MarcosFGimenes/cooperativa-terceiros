import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { PublicAccessError, requireServiceAccess } from "@/lib/public-access";
import { addManualUpdate } from "@/lib/repo/services";

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const serviceId = searchParams.get("serviceId") ?? "";
  const queryToken = searchParams.get("token");
  const cookieToken = cookies().get("access_token")?.value ?? "";
  const token = queryToken && queryToken.trim() ? queryToken.trim() : cookieToken;

  try {
    const { service } = await requireServiceAccess(token, serviceId);
    if (service.hasChecklist) {
      throw new PublicAccessError(400, "Serviço possui checklist. Use a rota apropriada.");
    }

    const body = (await req.json().catch(() => ({}))) as { percent?: unknown; note?: unknown };
    const percent = Number(body.percent);
    if (!Number.isFinite(percent)) {
      throw new PublicAccessError(400, "percent inválido");
    }

    const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : undefined;
    const sanitizedPercent = await addManualUpdate(service.id, percent, note, token);

    return NextResponse.json({ ok: true, realPercent: sanitizedPercent });
  } catch (err: unknown) {
    if (err instanceof PublicAccessError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }

    console.error("[api/public/service/update-manual] Falha inesperada", err);
    return NextResponse.json({ ok: false, error: "Erro interno" }, { status: 500 });
  }
}
