import { adminAuth } from "@/lib/firebaseAdmin";
import { isPCMUser } from "@/lib/pcmAuth";
import type { DecodedIdToken } from "firebase-admin/auth";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
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

  const email = decoded.email;
  if (!email) {
    throw new HttpError(401, "Token não possui e-mail associado");
  }

  if (!isPCMUser(email)) {
    console.error("[requirePcmUser] Usuário não autorizado", { email });
    throw new HttpError(401, "Usuário não autorizado");
  }

  return { uid: decoded.uid, email: email.toLowerCase(), token: decoded };
}
