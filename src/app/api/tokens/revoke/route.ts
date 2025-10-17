import { NextRequest, NextResponse } from "next/server";

import { tryGetAdminDb, getServerWebDb } from "@/lib/serverDb";

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token || typeof token !== "string") {
      return NextResponse.json({ ok: false, error: "missing_token" }, { status: 400 });
    }

    const trimmed = token.trim().toUpperCase();
    const adminDb = tryGetAdminDb();

    if (adminDb) {
      const byCode = await adminDb.collection("accessTokens").where("code", "==", trimmed).limit(1).get();
      let doc = byCode.docs[0];
      if (!doc) {
        const legacy = await adminDb.collection("accessTokens").where("token", "==", trimmed).limit(1).get();
        doc = legacy.docs[0];
      }
      if (!doc) return NextResponse.json({ ok: true, found: false });
      await doc.ref.update({ active: false, status: "revoked" });
      return NextResponse.json({ ok: true, found: true });
    }

    const webDb = await getServerWebDb();
    const { collection, query, where, limit, getDocs, updateDoc, doc: docRef } = await import("firebase/firestore");
    let q = query(collection(webDb, "accessTokens"), where("code", "==", trimmed), limit(1));
    let snap = await getDocs(q);
    if (snap.empty) {
      q = query(collection(webDb, "accessTokens"), where("token", "==", trimmed), limit(1));
      snap = await getDocs(q);
    }
    if (snap.empty) return NextResponse.json({ ok: true, found: false });
    const found = snap.docs[0];
    await updateDoc(docRef(webDb, "accessTokens", found.id), { active: false, status: "revoked" });
    return NextResponse.json({ ok: true, found: true });
  } catch (e: any) {
    console.error("[tokens/revoke]", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
