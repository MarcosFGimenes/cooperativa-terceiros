import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";

import { getAdminApp } from "@/lib/firebaseAdmin";
import { isIdentityToolkitConfigured, verifyFirebaseIdToken } from "@/lib/firebaseIdentity";
import { isPCMUser } from "@/lib/pcmAuth";
import {
  PCM_SESSION_MAX_AGE_SECONDS,
  clearPcmSessionCookie,
  getPcmSessionCookie,
  setPcmSessionCookie,
} from "@/lib/auth/pcmSession";

const SESSION_MAX_AGE = PCM_SESSION_MAX_AGE_SECONDS * 1000;

async function setFallbackSessionCookie(idToken: string, expiresAtSeconds: number) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const remaining = Math.floor(expiresAtSeconds - nowSeconds);
  if (!Number.isFinite(remaining) || remaining <= 0) {
    return false;
  }
  const maxAgeSeconds = Math.min(PCM_SESSION_MAX_AGE_SECONDS, remaining);
  if (maxAgeSeconds <= 0) {
    return false;
  }
  await setPcmSessionCookie(idToken, maxAgeSeconds);
  return true;
}

async function handleFallback(idToken: string) {
  if (!isIdentityToolkitConfigured()) {
    console.error("[pcm-session] Identity Toolkit não configurado para fallback");
    return NextResponse.json({ ok: false, error: "admin_not_configured" }, { status: 503 });
  }

  const verification = await verifyFirebaseIdToken(idToken);
  if (!verification) {
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 401 });
  }

  const email = verification.email ?? "";
  if (!email || !isPCMUser(email)) {
    console.error("[pcm-session] Usuário sem permissão (fallback)", { email });
    return NextResponse.json({ ok: false, error: "not_allowed" }, { status: 403 });
  }

  if (!(await setFallbackSessionCookie(idToken, verification.expiresAtSeconds))) {
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 401 });
  }

  return NextResponse.json({ ok: true, mode: "id_token" });
}

export async function POST(req: Request) {
  const { token } = await req.json().catch(() => ({}));

  if (typeof token !== "string" || !token.trim()) {
    return NextResponse.json({ ok: false, error: "missing_token" }, { status: 400 });
  }

  const trimmedToken = token.trim();

  const app = getAdminApp();
  if (!app) {
    console.error("[pcm-session] Firebase Admin não configurado — usando fallback");
    return handleFallback(trimmedToken);
  }

  const auth = getAuth(app);

  try {
    const decoded = await auth.verifyIdToken(trimmedToken, true);
    const email = decoded.email ?? "";
    if (!email || !isPCMUser(email)) {
      console.error("[pcm-session] Usuário sem permissão para PCM", { email });
      return NextResponse.json({ ok: false, error: "not_allowed" }, { status: 403 });
    }

    try {
      const sessionCookie = await auth.createSessionCookie(trimmedToken, { expiresIn: SESSION_MAX_AGE });
      await setPcmSessionCookie(sessionCookie, PCM_SESSION_MAX_AGE_SECONDS);
      return NextResponse.json({ ok: true, mode: "session" });
    } catch (cookieError) {
      console.error("[pcm-session] Falha ao criar cookie de sessão. Tentando fallback", cookieError);
      return handleFallback(trimmedToken);
    }
  } catch (error) {
    console.error("[pcm-session] Falha ao verificar token com Firebase Admin", error);
    return handleFallback(trimmedToken);
  }
}

export async function DELETE() {
  const sessionCookie = await getPcmSessionCookie();
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

  await clearPcmSessionCookie();
  return NextResponse.json({ ok: true });
}
