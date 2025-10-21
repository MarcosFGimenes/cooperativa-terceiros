import { tryGetAuth, tryGetFirestore } from "./firebase";
import { collection, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

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
