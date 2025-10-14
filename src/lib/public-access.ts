import type { ChecklistItem, Package, Service, ServiceStatus } from "@/lib/types";
import { adminDb } from "@/lib/firebaseAdmin";

const accessTokensCollection = () => adminDb.collection("accessTokens");
const servicesCollection = () => adminDb.collection("services");
const packagesCollection = () => adminDb.collection("packages");

export class PublicAccessError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type FirestoreTimestamp = { toMillis?: () => number } | null | undefined;

function toMillis(value: unknown | FirestoreTimestamp): number | undefined {
  if (typeof value === "number") return value;
  if (!value) return undefined;
  const maybeTimestamp = value as FirestoreTimestamp;
  const millis = maybeTimestamp?.toMillis?.();
  if (typeof millis === "number" && Number.isFinite(millis)) return millis;
  return undefined;
}

type AccessTokenData = {
  targetType?: string;
  targetId?: string;
  company?: string;
  companyId?: string;
  revoked?: boolean;
  active?: boolean;
  expiresAt?: unknown;
};

function getTokenCompany(token: AccessTokenData): string | undefined {
  if (typeof token.companyId === "string" && token.companyId.trim()) return token.companyId.trim();
  if (typeof token.company === "string" && token.company.trim()) return token.company.trim();
  return undefined;
}

async function fetchToken(tokenId: string): Promise<AccessTokenData> {
  const snap = await accessTokensCollection().doc(tokenId).get();
  if (!snap.exists) {
    throw new PublicAccessError(403, "Token inválido");
  }

  const data = (snap.data() || {}) as AccessTokenData;
  if (data.revoked === true || data.active === false) {
    throw new PublicAccessError(403, "Token inativo");
  }

  const expiresAt = toMillis(data.expiresAt as unknown);
  if (expiresAt && expiresAt < Date.now()) {
    throw new PublicAccessError(403, "Token expirado");
  }

  return { ...data, targetType: data.targetType, targetId: data.targetId };
}

function normalizeCompany(data: FirebaseFirestore.DocumentData): string | undefined {
  if (typeof data.company === "string" && data.company.trim()) return data.company.trim();
  if (typeof data.companyId === "string" && data.companyId.trim()) return data.companyId.trim();
  return undefined;
}

function mapServiceDoc(doc: FirebaseFirestore.DocumentSnapshot): Service {
  const data = doc.data() ?? {};
  return {
    id: doc.id,
    os: data.os ?? "",
    oc: data.oc ?? undefined,
    tag: data.tag ?? "",
    equipmentName: data.equipmentName ?? "",
    sector: data.sector ?? "",
    plannedStart: data.plannedStart ?? "",
    plannedEnd: data.plannedEnd ?? "",
    totalHours: data.totalHours ?? 0,
    status: (data.status ?? "aberto") as ServiceStatus,
    company: normalizeCompany(data),
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
    hasChecklist: data.hasChecklist ?? false,
    realPercent: data.realPercent ?? 0,
    packageId: data.packageId ?? undefined,
  };
}

function ensureCompanyMatch(token: AccessTokenData, data: FirebaseFirestore.DocumentData) {
  const tokenCompany = getTokenCompany(token);
  if (!tokenCompany) return;

  const serviceCompany = normalizeCompany(data);

  if (serviceCompany && serviceCompany !== tokenCompany) {
    throw new PublicAccessError(403, "Token não possui acesso a este serviço");
  }
}

export async function requireServiceAccess(
  tokenId: string,
  serviceId: string,
  preloadedToken?: AccessTokenData,
): Promise<{
  token: AccessTokenData;
  service: Service;
}> {
  if (!tokenId) throw new PublicAccessError(400, "Token ausente");
  if (!serviceId) throw new PublicAccessError(400, "serviceId ausente");

  const token = preloadedToken ?? await fetchToken(tokenId);
  if (token.targetType !== "service" || token.targetId !== serviceId) {
    throw new PublicAccessError(403, "Token não corresponde ao serviço");
  }

  const snap = await servicesCollection().doc(serviceId).get();
  if (!snap.exists) {
    throw new PublicAccessError(404, "Serviço não encontrado");
  }

  const data = snap.data() ?? {};
  if ((data.status ?? "aberto") !== "aberto") {
    throw new PublicAccessError(403, "Serviço fechado");
  }

  ensureCompanyMatch(token, data);

  const service = mapServiceDoc(snap);
  return { token, service };
}

function mapPackageDoc(doc: FirebaseFirestore.DocumentSnapshot): Package {
  const data = doc.data() ?? {};
  return {
    id: doc.id,
    name: data.name ?? "",
    status: data.status ?? "aberto",
    serviceIds: Array.isArray(data.serviceIds) ? data.serviceIds : [],
    createdAt: toMillis(data.createdAt),
  };
}

export async function requirePackageAccess(
  tokenId: string,
  packageId: string,
  preloadedToken?: AccessTokenData,
): Promise<{
  token: AccessTokenData;
  pkg: Package;
}> {
  if (!tokenId) throw new PublicAccessError(400, "Token ausente");
  if (!packageId) throw new PublicAccessError(400, "packageId ausente");

  const token = preloadedToken ?? await fetchToken(tokenId);
  if (token.targetType !== "package" || token.targetId !== packageId) {
    throw new PublicAccessError(403, "Token não corresponde ao pacote");
  }

  const snap = await packagesCollection().doc(packageId).get();
  if (!snap.exists) {
    throw new PublicAccessError(404, "Pacote não encontrado");
  }

  const pkg = mapPackageDoc(snap);
  if ((pkg.status ?? "aberto") !== "aberto") {
    throw new PublicAccessError(403, "Pacote não está disponível");
  }

  return { token, pkg };
}

export function filterServicesByTokenCompany<T extends { company?: string | null | undefined }>(
  services: T[],
  token: AccessTokenData,
): T[] {
  const tokenCompany = getTokenCompany(token);
  if (!tokenCompany) return services;
  return services.filter((service) => {
    if (!service.company) return true;
    return service.company === tokenCompany;
  });
}

export async function fetchServiceChecklist(serviceId: string): Promise<ChecklistItem[]> {
  const col = servicesCollection().doc(serviceId).collection("checklist");
  const snap = await col.orderBy("description", "asc").get();
  return snap.docs.map((doc) => {
    const data = doc.data() ?? {};
    return {
      id: doc.id,
      serviceId,
      description: data.description ?? "",
      weight: data.weight ?? 0,
      progress: data.progress ?? 0,
      status: (data.status ?? "nao_iniciado") as ChecklistItem["status"],
      updatedAt: toMillis(data.updatedAt),
    };
  });
}

export async function fetchPackageServices(packageId: string): Promise<Service[]> {
  const snap = await servicesCollection().where("packageId", "==", packageId).get();
  return snap.docs.map((doc) => mapServiceDoc(doc));
}

export async function resolvePublicAccessRedirect(tokenId: string): Promise<{
  redirectPath: string;
  targetType: "service" | "package";
  targetId: string;
}> {
  if (!tokenId) throw new PublicAccessError(400, "Token ausente");

  const token = await fetchToken(tokenId);
  const targetId = token.targetId?.trim();

  if (!targetId) {
    throw new PublicAccessError(400, "Token sem destino configurado");
  }

  if (token.targetType === "service") {
    const { service } = await requireServiceAccess(tokenId, targetId, token);
    return {
      redirectPath: `/s/${service.id}`,
      targetType: "service",
      targetId: service.id,
    };
  }

  if (token.targetType === "package") {
    const { pkg } = await requirePackageAccess(tokenId, targetId, token);
    return {
      redirectPath: `/p/${pkg.id}`,
      targetType: "package",
      targetId: pkg.id,
    };
  }

  throw new PublicAccessError(400, "Token sem destino configurado");
}
