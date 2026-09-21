import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { PublicAccessError, requireServiceAccess } from "@/lib/public-access";
import { addComputedUpdate, updateChecklistProgress } from "@/lib/repo/services";
import { ProgressDecreaseError } from "@/lib/progressValidation";
import type { ChecklistItem } from "@/lib/types";
import { mapFirestoreError } from "@/lib/utils/firestoreErrors";

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const serviceId = searchParams.get("serviceId") ?? "";
  const queryToken = searchParams.get("token") ?? "";
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get("access_token")?.value ?? "";
  const token = queryToken.trim() ? queryToken.trim() : cookieToken;

  try {
    const { service } = await requireServiceAccess(token, serviceId);

    const body = (await req.json().catch(() => ({}))) as {
      updates?: Array<{ id?: unknown; progress?: unknown; status?: unknown }>;
      note?: unknown;
      recordUpdate?: unknown;
    };

    if (!Array.isArray(body.updates)) {
      throw new PublicAccessError(400, "updates deve ser um array");
    }

    const validStatuses: ChecklistItem["status"][] = [
      "nao_iniciado",
      "andamento",
      "concluido",
    ];

    const updates = body.updates.map((item) => {
      const id = typeof item.id === "string" ? item.id : null;
      const progress = Number(item.progress);
      const status =
        typeof item.status === "string" && validStatuses.includes(item.status as ChecklistItem["status"])
          ? (item.status as ChecklistItem["status"])
          : undefined;
      if (!id || !Number.isFinite(progress)) {
        throw new PublicAccessError(400, "updates inválidos");
      }
      return { id, progress, status };
    });

    const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : undefined;
    const isRdoSubmission = body.recordUpdate === false;

    // No formulário de RDO, o checklist é gravado antes do lançamento manual
    // completo. A validação de não redução deve ocorrer naquele lançamento,
    // que usa o percentual final informado pelo terceiro. Validar o percentual
    // intermediário do checklist aqui pode rejeitar o RDO mesmo quando seu
    // percentual final é maior que o progresso atual (por exemplo, após uma
    // correção de 100% para 70%).
    const realPercent = await updateChecklistProgress(service.id, updates, {
      preventDecrease: !isRdoSubmission,
    });
    // A tela de RDO atualiza o checklist e, em seguida, grava o lançamento
    // completo pela rota update-manual. Nesse fluxo não devemos criar antes um
    // segundo documento mínimo na coleção `updates`.
    if (!isRdoSubmission) {
      await addComputedUpdate(service.id, realPercent, note, token);
    }

    return NextResponse.json({ ok: true, realPercent });
  } catch (err: unknown) {
    if (err instanceof ProgressDecreaseError) {
      return NextResponse.json(
        { ok: false, error: err.message, currentPercent: err.currentPercent },
        { status: 409 },
      );
    }
    if (err instanceof PublicAccessError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }
    const firestoreError = mapFirestoreError(err);
    if (firestoreError) {
      return NextResponse.json(
        { ok: false, error: firestoreError.message },
        { status: firestoreError.status },
      );
    }
    if (err instanceof Error && /Item do checklist/.test(err.message)) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 404 });
    }
    if (err instanceof Error && /Serviço não encontrado/.test(err.message)) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 404 });
    }

    console.error("[api/public/service/update-checklist] Falha inesperada", err);
    return NextResponse.json({ ok: false, error: "Erro interno" }, { status: 500 });
  }
}
