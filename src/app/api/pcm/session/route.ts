import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";

import { getAdminApp } from "@/lib/firebaseAdmin";
import { isPCMUser } from "@/lib/pcmAuth";
import {
  PCM_SESSION_MAX_AGE_SECONDS,
  clearPcmSessionCookie,
  getPcmSessionCookie,
  setPcmSessionCookie,
} from "@/lib/auth/pcmSession";

const SESSION_MAX_AGE = PCM_SESSION_MAX_AGE_SECONDS * 1000;

export async function POST(req: Request) {
  const { token } = await req.json().catch(() => ({}));

  if (typeof token !== "string" || !token.trim()) {
    return NextResponse.json({ ok: false, error: "missing_token" }, { status: 400 });
  }

  const app = getAdminApp();
  if (!app) {
    console.error("[pcm-session] Firebase Admin não configurado");
    return NextResponse.json({ ok: false, error: "admin_not_configured" }, { status: 503 });
  }

  const auth = getAuth(app);

  try {
    const decoded = await auth.verifyIdToken(token, true);
    const email = decoded.email ?? "";
    if (!email || !isPCMUser(email)) {
      console.error("[pcm-session] Usuário sem permissão para PCM", { email });
      return NextResponse.json({ ok: false, error: "not_allowed" }, { status: 403 });
    }

    const sessionCookie = await auth.createSessionCookie(token, { expiresIn: SESSION_MAX_AGE });
    setPcmSessionCookie(sessionCookie, PCM_SESSION_MAX_AGE_SECONDS);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[pcm-session] Falha ao criar cookie de sessão", error);
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 401 });
  }
}

export async function DELETE() {
  const sessionCookie = getPcmSessionCookie();
  const app = getAdminApp();

  if (sessionCookie && app) {
    const auth = getAuth(app);
    try {
      const decoded = await auth.verifySessionCookie(sessionCookie, false);
      await auth.revokeRefreshTokens(decoded.sub);
    } catch (error) {
      console.error("[pcm-session] Falha ao revogar sessão", error);
    }
  }

  clearPcmSessionCookie();
  return NextResponse.json({ ok: true });
}
