import { NextResponse, type NextRequest } from "next/server";
import { Timestamp } from "firebase-admin/firestore";

import { HttpError, requirePcmUser } from "@/app/api/management/tokens/_lib/auth";
import { recomputeServiceProgress } from "@/lib/progressHistoryServer";
import { AdminDbUnavailableError, getAdminDbOrThrow } from "@/lib/serverDb";
import { mapFirestoreError } from "@/lib/utils/firestoreErrors";

type RequestBody = {
  serviceId?: unknown;
  updateId?: unknown;
  source?: unknown;
  date?: unknown;
  percent?: unknown;
};

function requiredString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function POST(request: NextRequest) {
  try {
    await requirePcmUser(request);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 401;
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status });
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const serviceId = requiredString(body.serviceId);
  const updateId = requiredString(body.updateId);
  const source = body.source === "updates" || body.source === "serviceUpdates" ? body.source : null;
  const date = typeof body.date === "string" ? new Date(body.date) : null;
  const percent = typeof body.percent === "number" ? body.percent : Number(body.percent);

  if (!serviceId || !updateId || !source || !date || Number.isNaN(date.getTime())) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    return NextResponse.json({ ok: false, error: "invalid_percent" }, { status: 400 });
  }

  try {
    const adminDb = getAdminDbOrThrow();
    const updateRef = adminDb.collection("services").doc(serviceId).collection(source).doc(updateId);
    const snapshot = await updateRef.get();
    if (!snapshot.exists) {
      return NextResponse.json({ ok: false, error: "update_not_found" }, { status: 404 });
    }

    const timestamp = Timestamp.fromDate(date);
    const common = { date: timestamp, reportDate: timestamp, updatedAt: Timestamp.now() };
    await updateRef.update(
      source === "updates"
        ? { ...common, realPercentSnapshot: percent, manualPercent: percent, percent }
        : { ...common, totalPct: percent },
    );

    // Recalcula a partir de todo o histórico: editar um lançamento antigo não pode
    // substituir o lançamento mais recente. A rotina também invalida serviço,
    // dashboard, pacote e pasta vinculados.
    const result = await recomputeServiceProgress(serviceId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof AdminDbUnavailableError) {
      return NextResponse.json({ ok: false, error: "admin_unavailable" }, { status: 500 });
    }
    const mapped = mapFirestoreError(error);
    if (mapped) return NextResponse.json({ ok: false, error: mapped.message }, { status: mapped.status });
    console.error("[pcm/servicos/update-progress-entry] Falha ao editar lançamento", error);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
