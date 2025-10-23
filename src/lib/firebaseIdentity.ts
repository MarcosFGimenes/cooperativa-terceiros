const IDENTITY_TOOLKIT_URL = "https://identitytoolkit.googleapis.com/v1/accounts:lookup";

type IdentityToolkitUser = {
  localId: string;
  email?: string;
  emailVerified?: boolean;
  validSince?: string;
  disabled?: boolean;
};

type IdentityToolkitResponse = {
  users?: IdentityToolkitUser[];
};

type JwtPayload = Record<string, unknown> & {
  exp?: number;
  iat?: number;
  auth_time?: number;
  aud?: string;
  email?: string;
};

export type FirebaseIdTokenVerification = {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  expiresAtSeconds: number;
  issuedAtSeconds: number;
  authTimeSeconds: number | null;
};

function readEnvValue(names: string[]): string | null {
  for (const name of names) {
    const raw = process.env[name];
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    return trimmed;
  }
  return null;
}

let cachedApiKey: string | null | undefined;
function getFirebaseApiKey() {
  if (cachedApiKey !== undefined) return cachedApiKey;
  cachedApiKey = readEnvValue(["NEXT_PUBLIC_FIREBASE_API_KEY", "FIREBASE_API_KEY"]);
  return cachedApiKey;
}

export function isIdentityToolkitConfigured(): boolean {
  return Boolean(getFirebaseApiKey());
}

let cachedProjectId: string | null | undefined;
function getFirebaseProjectId() {
  if (cachedProjectId !== undefined) return cachedProjectId;
  cachedProjectId = readEnvValue([
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "FIREBASE_PROJECT_ID",
    "FIREBASE_ADMIN_PROJECT_ID",
    "FIREBASE_PROJECT",
    "GOOGLE_CLOUD_PROJECT",
    "GCLOUD_PROJECT",
  ]);
  return cachedProjectId;
}

function base64UrlDecode(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? 0 : 4 - (normalized.length % 4);
  const padded = normalized + "=".repeat(padding);
  return Buffer.from(padded, "base64").toString("utf8");
}

function decodeJwtPayload(token: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }
  try {
    const json = base64UrlDecode(parts[1]!);
    return JSON.parse(json) as JwtPayload;
  } catch (error) {
    console.error("[firebase-identity] Falha ao decodificar payload JWT", error);
    return null;
  }
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

async function fetchIdentityToolkitUser(
  idToken: string,
): Promise<IdentityToolkitUser | null> {
  const apiKey = getFirebaseApiKey();
  if (!apiKey) {
    console.error(
      "[firebase-identity] NEXT_PUBLIC_FIREBASE_API_KEY (ou FIREBASE_API_KEY) não está configurada.",
    );
    return null;
  }

  try {
    const response = await fetch(`${IDENTITY_TOOLKIT_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
      cache: "no-store",
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      console.error("[firebase-identity] Falha ao consultar Identity Toolkit", {
        status: response.status,
        body: errorBody,
      });
      return null;
    }

    const data = (await response.json()) as IdentityToolkitResponse;
    return data.users && data.users.length > 0 ? data.users[0]! : null;
  } catch (error) {
    console.error("[firebase-identity] Erro ao consultar Identity Toolkit", error);
    return null;
  }
}

function isTokenExpired(expiresAtSeconds: number): boolean {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return !Number.isFinite(expiresAtSeconds) || expiresAtSeconds <= nowSeconds;
}

function isTokenRevoked(
  authTimeSeconds: number | null,
  validSinceSeconds: number | null,
): boolean {
  if (!authTimeSeconds || !validSinceSeconds) return false;
  return authTimeSeconds < validSinceSeconds;
}

export async function verifyFirebaseIdToken(
  idToken: string,
): Promise<FirebaseIdTokenVerification | null> {
  if (typeof idToken !== "string" || !idToken.includes(".")) {
    return null;
  }

  const payload = decodeJwtPayload(idToken);
  if (!payload) return null;

  const exp = toNumber(payload.exp);
  const iat = toNumber(payload.iat);
  const authTime = toNumber(payload.auth_time);
  if (exp === null || iat === null) {
    console.error("[firebase-identity] Token sem campos exp/iat válidos");
    return null;
  }

  const expectedProjectId = getFirebaseProjectId();
  const audience = typeof payload.aud === "string" ? payload.aud : undefined;
  if (expectedProjectId && audience && audience !== expectedProjectId) {
    console.error("[firebase-identity] Token emitido para outro projeto", {
      audience,
      expectedProjectId,
    });
    return null;
  }

  if (isTokenExpired(exp)) {
    return null;
  }

  const user = await fetchIdentityToolkitUser(idToken);
  if (!user || user.disabled) {
    return null;
  }

  const validSince = toNumber(user.validSince ?? null);
  if (isTokenRevoked(authTime, validSince)) {
    console.warn("[firebase-identity] Token revogado detectado", {
      uid: user.localId,
    });
    return null;
  }

  return {
    uid: user.localId,
    email: user.email?.trim() || null,
    emailVerified: Boolean(user.emailVerified),
    expiresAtSeconds: exp,
    issuedAtSeconds: iat,
    authTimeSeconds: authTime,
  };
}
