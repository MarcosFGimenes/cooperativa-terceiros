import { adminAuth } from "@/lib/firebaseAdmin";
import type { DecodedIdToken } from "firebase-admin/auth";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

function normalizeAllowlist(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[,;\s]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export type AuthenticatedUser = {
  uid: string;
  email: string;
  token: DecodedIdToken;
};

export async function requirePcmUser(req: Request): Promise<AuthenticatedUser> {
  const header = req.headers.get("authorization");
  if (!header) {
    throw new HttpError(401, "Authorization header ausente");
  }

  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new HttpError(401, "Formato do header Authorization inválido");
  }

  let decoded: DecodedIdToken;
  try {
    decoded = await adminAuth.verifyIdToken(match[1]);
  } catch (err: unknown) {
    console.error("[requirePcmUser] Falha ao verificar token", err);
    throw new HttpError(401, "Token inválido");
  }

  const email = decoded.email?.toLowerCase();
  if (!email) {
    throw new HttpError(403, "Token não possui e-mail associado");
  }

  const allowlist = normalizeAllowlist(process.env.PCM_EMAILS);
  if (!allowlist.length) {
    console.error("[requirePcmUser] PCM_EMAILS não configurado");
    throw new HttpError(403, "PCM_EMAILS não configurado");
  }

  if (!allowlist.includes(email)) {
    throw new HttpError(403, "Usuário não autorizado");
  }

  return { uid: decoded.uid, email, token: decoded };
}
