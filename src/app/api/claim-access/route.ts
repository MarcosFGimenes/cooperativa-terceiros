import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export async function POST(req: Request) {
  try {
    const { token } = await req.json() as { token?: string };
    if (!token) return NextResponse.json({ ok: false, error: "token ausente" }, { status: 400 });

    // Se existir a coleção "accessTokens", valida de fato:
    try {
      const snap = await adminDb.collection("accessTokens").doc(token).get();
      if (snap.exists) {
        const data = snap.data() || {};
        return NextResponse.json({ ok: true, found: true, data });
      }
    } catch { /* Firestore pode não existir ainda; segue para resposta demo */ }

    // Fallback de demo: aceita qualquer token não-vazio
    return NextResponse.json({ ok: true, found: false, note: "modo demo: token aceito, crie a coleção accessTokens para validação real" });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "internal" }, { status: 500 });
  }
}
