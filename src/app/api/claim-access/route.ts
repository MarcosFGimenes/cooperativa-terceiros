import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toMillis(v: any): number | null {
  try {
    // @ts-ignore
    if (v && typeof v.toMillis === "function") return v.toMillis();
    if (v instanceof Date) return v.getTime();
  } catch {}
  return null;
}

export async function POST(req: Request) {
  try {
    const { tokenId } = await req.json();
    if (!tokenId) return NextResponse.json({ error: "tokenId requerido" }, { status: 400 });

    // Valida token
    const tokenSnap = await adminDb().collection("accessTokens").doc(tokenId).get();
    if (!tokenSnap.exists) return NextResponse.json({ error: "Token inválido" }, { status: 404 });

    const t = tokenSnap.data() as any;
    if (t.revoked) return NextResponse.json({ error: "Token revogado" }, { status: 403 });

    const exp = toMillis(t.expiresAt);
    if (exp && exp < Date.now()) return NextResponse.json({ error: "Token expirado" }, { status: 410 });

    const col = t.targetType === "service" ? "services" : "packages";
    const targetSnap = await adminDb().collection(col).doc(t.targetId).get();
    if (!targetSnap.exists) return NextResponse.json({ error: "Alvo não encontrado" }, { status: 404 });

    const target = targetSnap.data() as any;
    if (target.status !== "aberto") return NextResponse.json({ error: "Alvo não está aberto" }, { status: 403 });

    // Usuário efêmero por token
    const uid = `token:${tokenId}`;
    try { await adminAuth().getUser(uid); } catch { await adminAuth().createUser({ uid }); }

    const claims: Record<string, any> = { role: "third" };
    if (t.targetType === "service") claims.serviceId = t.targetId;
    if (t.targetType === "package") claims.packageId = t.targetId;
    if (t.companyId) claims.companyId = t.companyId;

    await adminAuth().setCustomUserClaims(uid, claims);
    if (t.oneTime) await tokenSnap.ref.update({ revoked: true });

    const customToken = await adminAuth().createCustomToken(uid, claims);
    return NextResponse.json({ customToken, targetType: t.targetType, targetId: t.targetId }, { status: 200 });
  } catch (e: any) {
    // imprime detalhe no server e devolve mensagem amigável no client
    console.error("[api/claim-access] ERRO:", e?.stack || e);
    const msg = e?.message || String(e);
    return NextResponse.json({ error: "internal", message: msg }, { status: 500 });
  }
}
