import { NextResponse } from "next/server";

import { requirePcmUser } from "@/app/api/admin/tokens/_lib/auth";
import { updatePackageFolder } from "@/lib/repo/folders";

function normaliseParam(value: string | string[] | undefined): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value) && value.length > 0) return String(value[0] ?? "").trim();
  return "";
}

export async function PATCH(
  req: Request,
  context: { params: Record<string, string | string[] | undefined> },
) {
  await requirePcmUser(req);
  const packageId = normaliseParam(context.params.packageId);
  const folderId = normaliseParam(context.params.folderId);

  if (!packageId || !folderId) {
    return NextResponse.json({ ok: false, error: "Parâmetros inválidos" }, { status: 400 });
  }

  let payload: { name?: unknown; companyId?: unknown } = {};
  try {
    payload = (await req.json().catch(() => ({}))) as { name?: unknown; companyId?: unknown };
  } catch {
    payload = {};
  }

  const updates: { name?: string; companyId?: string | null } = {};
  if (payload.name !== undefined) {
    const value = typeof payload.name === "string" ? payload.name : String(payload.name ?? "");
    updates.name = value.trim();
  }
  if (payload.companyId !== undefined) {
    const value = typeof payload.companyId === "string" ? payload.companyId : String(payload.companyId ?? "");
    const trimmed = value.trim();
    updates.companyId = trimmed || null;
  }

  if (!("name" in updates) && !("companyId" in updates)) {
    return NextResponse.json({ ok: false, error: "Nenhum campo para atualizar" }, { status: 400 });
  }

  try {
    const folder = await updatePackageFolder(folderId, updates);
    return NextResponse.json({ ok: true, folder });
  } catch (error) {
    console.error("[folders] Falha ao atualizar pasta", error);
    const message = error instanceof Error ? error.message : "Não foi possível atualizar a pasta.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
