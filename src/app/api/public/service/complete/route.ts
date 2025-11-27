import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { PublicAccessError, requireServiceAccess } from "@/lib/public-access";
import { addComputedUpdate } from "@/lib/repo/services";

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const serviceId = searchParams.get("serviceId") ?? "";
  const queryToken = searchParams.get("token");

  const cookieStore = await cookies();
  const cookieToken = cookieStore.get("access_token")?.value ?? "";
  const token = queryToken && queryToken.trim() ? queryToken.trim() : cookieToken;

  try {
    const { service } = await requireServiceAccess(token, serviceId);

    await addComputedUpdate(
      service.id,
      100,
      "Serviço marcado como concluído pelo portal",
      token || undefined,
    );

    return NextResponse.json({ ok: true, realPercent: 100 });
  } catch (error) {
    if (error instanceof PublicAccessError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }

    console.error("[public/service/complete] Falha ao concluir serviço", error);
    const message = error instanceof Error ? error.message : "Não foi possível concluir o serviço.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
