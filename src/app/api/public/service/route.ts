import { NextResponse } from "next/server";

import { PublicAccessError, fetchServiceChecklist, requireServiceAccess } from "@/lib/public-access";
import { listUpdates } from "@/lib/repo/services";
import { AdminDbUnavailableError } from "@/lib/serverDb";
import { mapFirestoreError } from "@/lib/utils/firestoreErrors";

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

    if (err instanceof AdminDbUnavailableError || (err instanceof Error && err.message === "FIREBASE_ADMIN_NOT_CONFIGURED")) {
      console.error("[api/public/service] Firebase Admin não configurado", err);
      return NextResponse.json(
        { ok: false, error: "Configuração de acesso ao banco indisponível." },
        { status: 500 },
      );
    }

    const mapped = mapFirestoreError(err);
    if (mapped) {
      console.warn("[api/public/service] Falha de acesso ao Firestore", err);
      return NextResponse.json({ ok: false, error: mapped.message }, { status: mapped.status });
    }

    console.error("[api/public/service] Falha inesperada", err);
    return NextResponse.json({ ok: false, error: "Erro interno" }, { status: 500 });
  }
}
