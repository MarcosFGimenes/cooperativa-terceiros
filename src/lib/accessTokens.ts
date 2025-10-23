import { tryGetAuth, tryGetFirestore } from "./firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

export function randomToken(len = 8) {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O/1/I
  let out = "";
  for (let i = 0; i < len; i++) out += a[Math.floor(Math.random() * a.length)];
  return out;
}

type NormalisedScope = {
  targetType: "service" | "package";
  targetId: string;
  company?: string;
};

type FirestoreLikeTimestamp =
  | { toMillis?: () => number; seconds?: number; nanoseconds?: number }
  | null
  | undefined;

type AccessTokenDoc = Record<string, unknown> & {
  active?: unknown;
  status?: unknown;
  revoked?: unknown;
  createdAt?: unknown;
  expiresAt?: unknown;
  company?: unknown;
  companyId?: unknown;
  empresa?: unknown;
  empresaId?: unknown;
  code?: unknown;
  targetId?: unknown;
  serviceId?: unknown;
  packageId?: unknown;
  pacoteId?: unknown;
};

type StoredToken = {
  code: string;
  createdAt?: number;
};

function normaliseScope(payload: {
  serviceId?: string | null;
  packageId?: string | null;
  pacoteId?: string | null;
  empresa?: string | null;
  company?: string | null;
}): NormalisedScope {
  const serviceId = (payload.serviceId ?? "").trim();
  const packageId = (payload.packageId ?? payload.pacoteId ?? "").trim();
  const company = (payload.empresa ?? payload.company ?? "").trim();

  if (serviceId) {
    return { targetType: "service", targetId: serviceId, company: company || undefined };
  }

  if (packageId) {
    return { targetType: "package", targetId: packageId, company: company || undefined };
  }

  throw new Error("É necessário informar serviceId ou packageId para gerar o token.");
}

function toMillis(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? undefined : time;
  }
  const ts = value as FirestoreLikeTimestamp;
  if (ts && typeof ts.toMillis === "function") {
    const millis = ts.toMillis();
    if (typeof millis === "number" && Number.isFinite(millis)) {
      return millis;
    }
  }
  if (ts && typeof ts.seconds === "number") {
    const base = ts.seconds * 1000;
    const fraction = typeof ts.nanoseconds === "number" ? ts.nanoseconds / 1_000_000 : 0;
    const total = base + fraction;
    return Number.isFinite(total) ? total : undefined;
  }
  return undefined;
}

function normaliseCompany(data: AccessTokenDoc): string | undefined {
  const candidates = [data.company, data.companyId, data.empresa, data.empresaId];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function isTokenActive(data: AccessTokenDoc, now: number): boolean {
  if (data.active === false) return false;
  if (data.revoked === true) return false;
  const status = typeof data.status === "string" ? data.status.trim().toLowerCase() : undefined;
  if (status === "revoked" || status === "inactive") return false;

  const expiresAt = toMillis(data.expiresAt);
  if (expiresAt && expiresAt < now) return false;

  return true;
}

async function findExistingToken(scope: NormalisedScope): Promise<StoredToken | null> {
  const { db } = tryGetFirestore();
  if (!db) return null;

  async function getSnapshot(field: "targetId" | "serviceId" | "packageId" | "pacoteId") {
    try {
      const q = query(
        collection(db, "accessTokens"),
        where("targetType", "==", scope.targetType),
        where(field, "==", scope.targetId),
        limit(20),
      );
      return await getDocs(q);
    } catch (error) {
      console.warn("[accessTokens] Falha ao consultar tokens existentes", error);
      return null;
    }
  }

  let snapshot: Awaited<ReturnType<typeof getSnapshot>> | null = null;
  const preferredFields: Array<"targetId" | "serviceId" | "packageId" | "pacoteId"> = ["targetId"];
  if (scope.targetType === "service") {
    preferredFields.push("serviceId");
  } else {
    preferredFields.push("packageId", "pacoteId");
  }

  for (const field of preferredFields) {
    const snap = await getSnapshot(field);
    if (snap && !snap.empty) {
      snapshot = snap;
      break;
    }
  }

  if (!snapshot) {
    return null;
  }

  const now = Date.now();
  const expectedCompany = scope.company ?? undefined;
  const tokens: StoredToken[] = [];

  snapshot.forEach((docSnap) => {
    const data = (docSnap.data() ?? {}) as AccessTokenDoc;
    if (!isTokenActive(data, now)) return;

    const tokenTargetId =
      (typeof data.targetId === "string" && data.targetId.trim()) ||
      (typeof data.serviceId === "string" && data.serviceId.trim()) ||
      (typeof data.packageId === "string" && data.packageId.trim()) ||
      (typeof data.pacoteId === "string" && data.pacoteId.trim()) ||
      null;

    if (tokenTargetId && tokenTargetId !== scope.targetId) {
      return;
    }

    const docCompany = normaliseCompany(data);
    if (expectedCompany) {
      if (!docCompany || docCompany !== expectedCompany) {
        return;
      }
    } else if (docCompany) {
      return;
    }

    const code =
      (typeof data.code === "string" && data.code.trim()) ||
      docSnap.id;

    if (!code) return;

    const createdAt = toMillis(data.createdAt);
    tokens.push({ code, createdAt });
  });

  if (!tokens.length) {
    return null;
  }

  tokens.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  return tokens[0] ?? null;
}

async function createTokenViaAdmin(scope: NormalisedScope): Promise<string> {
  const { auth, error } = tryGetAuth();
  const user = auth?.currentUser;
  if (!user) {
    const fallbackError = error ?? new Error("Faça login novamente para gerar tokens.");
    throw Object.assign(fallbackError, { status: 401 });
  }

  const idToken = await user.getIdToken();
  const response = await fetch("/api/admin/tokens/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      targetType: scope.targetType,
      targetId: scope.targetId,
      company: scope.company,
    }),
  });

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      data && typeof data === "object" && data && "error" in data && typeof (data as { error?: unknown }).error === "string"
        ? ((data as { error: string }).error ?? "")
        : "Não foi possível gerar o token.";
    const error = new Error(message || "Não foi possível gerar o token.");
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }

  if (!data || typeof data !== "object" || !("token" in data) || typeof (data as { token?: unknown }).token !== "string") {
    throw Object.assign(new Error("Resposta inesperada ao gerar token."), { status: response.status });
  }

  return (data as { token: string }).token;
}

async function createTokenFallback(scope: NormalisedScope): Promise<string> {
  const { db, error } = tryGetFirestore();
  if (!db) {
    throw error ?? new Error("Firestore não está configurado para gerar tokens.");
  }
  let code = randomToken(8);
  for (let attempt = 0; attempt < 5; attempt++) {
    const ref = doc(collection(db, "accessTokens"), code);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      code = randomToken(8);
      continue;
    }

    const payload: Record<string, unknown> = {
      code,
      token: code,
      status: "active",
      active: true,
      targetType: scope.targetType,
      targetId: scope.targetId,
      createdAt: serverTimestamp(),
    };

    if (scope.company) {
      payload.company = scope.company;
      payload.companyId = scope.company;
      payload.empresa = scope.company;
      payload.empresaId = scope.company;
    }

    if (scope.targetType === "service") {
      payload.serviceId = scope.targetId;
    } else {
      payload.packageId = scope.targetId;
      payload.pacoteId = scope.targetId;
    }

    await setDoc(ref, payload);
    return code;
  }

  throw new Error("Não foi possível gerar um token único.");
}

export async function createAccessToken(payload: {
  serviceId?: string;
  packageId?: string;
  pacoteId?: string;
  empresa?: string;
  company?: string;
}) {
  const scope = normaliseScope(payload);

  try {
    const existing = await findExistingToken(scope);
    if (existing?.code) {
      return existing.code;
    }
  } catch (error) {
    console.warn("[accessTokens] Falha ao reutilizar token existente", error);
  }

  try {
    return await createTokenViaAdmin(scope);
  } catch (error) {
    const status = (error as { status?: number } | null)?.status;
    if (typeof status === "number" && status >= 400 && status < 500) {
      throw error;
    }

    console.warn("[accessTokens] Falha ao usar API admin, tentando fallback", error);
    return createTokenFallback(scope);
  }
}
