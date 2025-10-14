import { NextResponse } from "next/server";
import { adminApp, adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const app = adminApp;
    const pid = app.options.projectId || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

    // ping rápido ao Firestore
    await adminDb.collection("_ping").doc("now").set({ t: Date.now() });
    const currentUsers = await app.auth().listUsers(1);

    return NextResponse.json({
      ok: true,
      projectId: pid,
      authUsersSample: currentUsers.users?.length || 0,
    });
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));
    console.error("[_debug/admin] ERRO:", error.stack ?? error.message);
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }
}
