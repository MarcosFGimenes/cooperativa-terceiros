import { NextRequest, NextResponse } from "next/server";

import { createAccessToken } from "@/lib/accessTokens";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body?.scope) return NextResponse.json({ ok: false, error: "missing_scope" }, { status: 400 });

    let serviceId: string | undefined;
    let packageId: string | undefined;
    let empresa: string | undefined;

    if (body.scope?.type === "service" && typeof body.scope?.serviceId === "string") {
      serviceId = body.scope.serviceId;
    } else if (body.scope?.type === "packageCompany") {
      if (typeof body.scope?.pacoteId === "string") packageId = body.scope.pacoteId;
      if (typeof body.scope?.packageId === "string") packageId = body.scope.packageId;
      if (typeof body.scope?.empresaId === "string") empresa = body.scope.empresaId;
      if (typeof body.scope?.company === "string") empresa = body.scope.company;
    }

    if (!serviceId && !packageId) {
      return NextResponse.json({ ok: false, error: "unsupported_scope" }, { status: 400 });
    }

    const token = await createAccessToken({ serviceId, packageId, empresa });
    return NextResponse.json({ ok: true, token });
  } catch (e: any) {
    console.error("[tokens/issue]", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
