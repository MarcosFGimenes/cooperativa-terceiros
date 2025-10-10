import { NextResponse } from "next/server";
import { adminDb, adminAuth, getAdminApp } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const app = getAdminApp();
    const pid = app.options.projectId || process.env.FIREBASE_ADMIN_PROJECT_ID;

    // ping rápido ao Firestore
    await adminDb().collection("_ping").doc("now").set({ t: Date.now() });
    const currentUsers = await adminAuth().listUsers(1);

    return NextResponse.json({
      ok: true,
      projectId: pid,
      authUsersSample: currentUsers.users?.length || 0,
    });
  } catch (e: any) {
    console.error("[_debug/admin] ERRO:", e?.stack || e);
    return NextResponse.json({ ok: false, message: e?.message || String(e) }, { status: 500 });
  }
}
