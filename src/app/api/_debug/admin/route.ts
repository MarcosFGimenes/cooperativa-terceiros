import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { app, db, auth } = getAdmin();
    const pid =
      app.options.projectId ||
      process.env.FIREBASE_PROJECT_ID ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

    // ping rápido ao Firestore
    await db.collection("_ping").doc("now").set({ t: Date.now() });
    const currentUsers = await auth.listUsers(1);

    return NextResponse.json({
      ok: true,
      projectId: pid,
      authUsersSample: currentUsers.users?.length || 0,
    });
  } catch (e: unknown) {
    if ((e as Error)?.message === "ADMIN_ENVS_MISSING") {
      return NextResponse.json({ ok: false, message: "Configuração do Firebase Admin ausente" }, { status: 503 });
    }
    const error = e instanceof Error ? e : new Error(String(e));
    console.error("[_debug/admin] ERRO:", error.stack ?? error.message);
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }
}
