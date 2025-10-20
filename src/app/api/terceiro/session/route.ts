import { NextResponse } from "next/server";

import { getTokenCookie } from "@/lib/tokenSession";
import { getServicesForToken, getTokenDoc } from "@/lib/terceiroService";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const token = getTokenCookie();
  if (!token) {
    return NextResponse.json({ ok: false, error: "missing_token" }, { status: 401 });
  }

  const tokenDoc = await getTokenDoc(token);
  if (!tokenDoc) {
    return NextResponse.json({ ok: false, error: "token_not_found" }, { status: 404 });
  }

  const companyId =
    (typeof tokenDoc.companyId === "string" && tokenDoc.companyId.trim()) ||
    (typeof tokenDoc.empresa === "string" && tokenDoc.empresa.trim()) ||
    (typeof tokenDoc.company === "string" && tokenDoc.company.trim()) ||
    null;

  const services = await getServicesForToken(token);

  return NextResponse.json({ ok: true, companyId, services });
}
