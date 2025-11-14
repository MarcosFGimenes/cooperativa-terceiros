import { NextResponse } from "next/server";

import { requirePcmUser } from "@/app/api/management/tokens/_lib/auth";
import { createPackageMetadata } from "@/lib/repo/packages";

function pickString(
  payload: Record<string, unknown>,
  keys: string[],
): string | null | undefined {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      const value = payload[key];
      if (typeof value === "string") return value;
      if (value === null) return null;
      return undefined;
    }
  }
  return undefined;
}

export async function POST(req: Request) {
  await requirePcmUser(req);

  let payload: Record<string, unknown> = {};
  try {
    payload = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  } catch {
    payload = {};
  }

  const name = pickString(payload, ["name", "nome"]);
  if (name === undefined || name === null || !name.trim()) {
    return NextResponse.json({ ok: false, error: "Informe o nome do pacote." }, { status: 400 });
  }

  const plannedStart = pickString(payload, ["plannedStart", "dataInicio", "inicioPlanejado", "startDate"]);
  if (typeof plannedStart !== "string" || !plannedStart.trim()) {
    return NextResponse.json({ ok: false, error: "Informe a data inicial do pacote." }, { status: 400 });
  }

  const plannedEnd = pickString(payload, ["plannedEnd", "dataFim", "fimPlanejado", "endDate"]);
  if (typeof plannedEnd !== "string" || !plannedEnd.trim()) {
    return NextResponse.json({ ok: false, error: "Informe a data final do pacote." }, { status: 400 });
  }

  const description = pickString(payload, ["description", "descricao", "details"]);

  const code = pickString(payload, ["code", "codigo"]);

  const statusValue = pickString(payload, ["status"]);

  try {
    const id = await createPackageMetadata({
      name,
      plannedStart,
      plannedEnd,
      description: description === undefined ? undefined : description,
      code: code === undefined ? undefined : code,
      status: typeof statusValue === "string" ? statusValue : undefined,
    });

    return NextResponse.json({ ok: true, id });
  } catch (error) {
    console.error("[packages:create] Falha ao criar pacote", error);
    const message = error instanceof Error ? error.message : "Não foi possível criar o pacote.";
    const status = /informe|inválid|posterior/i.test(message) ? 400 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
