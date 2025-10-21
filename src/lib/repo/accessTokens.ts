import "server-only";

import { getAdmin } from "@/lib/firebaseAdmin";

type FirestoreLikeTimestamp = {
  toMillis?: () => number;
  seconds?: number;
  nanoseconds?: number;
} | null | undefined;

type RawTokenData = Record<string, unknown> & {
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
  targetType?: unknown;
  serviceId?: unknown;
};

export type ServiceAccessToken = {
  code: string;
  company?: string;
  createdAt?: number;
  expiresAt?: number;
};

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

function normaliseCompany(data: RawTokenData): string | undefined {
  const candidates = [data.company, data.companyId, data.empresa, data.empresaId];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function isTokenActive(data: RawTokenData, now: number): boolean {
  if (data.active === false) return false;
  if (data.revoked === true) return false;
  const status = typeof data.status === "string" ? data.status.trim().toLowerCase() : undefined;
  if (status === "revoked" || status === "inactive") return false;

  const expiresAt = toMillis(data.expiresAt);
  if (expiresAt && expiresAt < now) return false;

  return true;
}

export async function getLatestServiceToken(serviceId: string): Promise<ServiceAccessToken | null> {
  if (!serviceId) return null;
  const { db } = getAdmin();

  const snap = await db
    .collection("accessTokens")
    .where("targetType", "==", "service")
    .where("targetId", "==", serviceId)
    .get();

  if (snap.empty) {
    return null;
  }

  const now = Date.now();
  const tokens: ServiceAccessToken[] = [];

  snap.docs.forEach((doc) => {
    const data = (doc.data() ?? {}) as RawTokenData;
    if (!isTokenActive(data, now)) return;

    const tokenTargetId =
      (typeof data.targetId === "string" && data.targetId.trim()) ||
      (typeof data.serviceId === "string" && data.serviceId.trim()) ||
      null;

    if (tokenTargetId && tokenTargetId !== serviceId) {
      return;
    }

    const code =
      (typeof data.code === "string" && data.code.trim()) ||
      doc.id;

    if (!code) return;

    const createdAt = toMillis(data.createdAt);
    const expiresAt = toMillis(data.expiresAt);

    tokens.push({
      code,
      company: normaliseCompany(data),
      createdAt,
      expiresAt,
    });
  });

  if (!tokens.length) {
    return null;
  }

  tokens.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  return tokens[0] ?? null;
}
