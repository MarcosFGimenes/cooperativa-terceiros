import { getAuth, type DecodedIdToken } from "firebase-admin/auth";

import { getAdminApp } from "@/lib/firebaseAdmin";
import { verifyFirebaseIdToken } from "@/lib/firebaseIdentity";
import { isPCMUser } from "@/lib/pcmAuth";
import { PCM_SESSION_COOKIE_NAME } from "@/lib/auth/pcmSession";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

export type AuthenticatedUser = {
  uid: string;
  email: string;
  token?: DecodedIdToken;
};

function normalizeEmail(email: string | null | undefined, context: string): string {
  const trimmed = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!trimmed) {
    throw new HttpError(401, `${context}: Token não possui e-mail associado`);
  }

  if (!isPCMUser(trimmed)) {
    console.error(`[requirePcmUser] Usuário não autorizado (${context})`, { email: trimmed });
    throw new HttpError(401, "Usuário não autorizado");
  }

  return trimmed;
}

function extractCookie(req: Request, name: string): string | null {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) {
    return null;
  }

  const pairs = cookieHeader.split(";");
  for (const pair of pairs) {
    const [rawName, ...rest] = pair.trim().split("=");
    if (!rawName) continue;
    if (rawName === name && rest.length > 0) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
}

async function verifyBearerToken(token: string): Promise<AuthenticatedUser> {
  const app = getAdminApp();
  if (app) {
    try {
      const decoded = await getAuth(app).verifyIdToken(token);
      const email = normalizeEmail(decoded.email, "bearer");
      return { uid: decoded.uid, email, token: decoded };
    } catch (err: unknown) {
      console.error("[requirePcmUser] Falha ao verificar token com Firebase Admin", err);
    }
  } else {
    console.warn("[requirePcmUser] Firebase Admin não configurado. Utilizando fallback Identity Toolkit.");
  }

  const fallback = await verifyFirebaseIdToken(token);
  if (!fallback) {
    throw new HttpError(app ? 401 : 503, app ? "Token inválido" : "Autenticação PCM indisponível");
  }

  const email = normalizeEmail(fallback.email, "bearer-fallback");
  return { uid: fallback.uid, email };
}

async function verifySessionCookieValue(cookieValue: string): Promise<AuthenticatedUser | null> {
  const app = getAdminApp();
  if (app) {
    try {
      const decoded = await getAuth(app).verifySessionCookie(cookieValue, true);
      const email = normalizeEmail(decoded.email, "session");
      return { uid: decoded.uid, email, token: decoded };
    } catch (error) {
      console.warn("[requirePcmUser] Falha ao verificar cookie de sessão PCM. Tentando fallback.", error);
    }
  }

  const fallback = await verifyFirebaseIdToken(cookieValue);
  if (!fallback) {
    return null;
  }

  const email = normalizeEmail(fallback.email, "session-fallback");
  return { uid: fallback.uid, email };
}

async function authenticateWithBearer(req: Request): Promise<AuthenticatedUser | null> {
  const header = req.headers.get("authorization");
  if (!header) {
    return null;
  }

  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new HttpError(401, "Formato do header Authorization inválido");
  }

  const bearerToken = match[1]!.trim();
  if (!bearerToken) {
    throw new HttpError(401, "Token inválido");
  }

  return verifyBearerToken(bearerToken);
}

async function authenticateWithSession(req: Request): Promise<AuthenticatedUser | null> {
  const cookieValue = extractCookie(req, PCM_SESSION_COOKIE_NAME);
  if (!cookieValue) {
    return null;
  }
  return verifySessionCookieValue(cookieValue);
}

export async function requirePcmUser(req: Request): Promise<AuthenticatedUser> {
  const bearerUser = await authenticateWithBearer(req);
  if (bearerUser) {
    return bearerUser;
  }

  const sessionUser = await authenticateWithSession(req);
  if (sessionUser) {
    return sessionUser;
  }

  throw new HttpError(401, "Credenciais PCM ausentes ou inválidas");
}
