import type { FirebaseFirestore } from "firebase-admin/firestore";

import type { ChecklistItem, Service, ServiceStatus } from "@/lib/types";
import { getAdmin } from "@/lib/firebaseAdmin";

type AccessTokenData = FirebaseFirestore.DocumentData & {
  targetType?: string;
  targetId?: string;
  company?: string;
  companyId?: string;
  revoked?: boolean;
  active?: boolean;
  expiresAt?: unknown;
  packageId?: string;
  pacoteId?: string;
  folderId?: string;
  pastaId?: string;
  oneTime?: boolean;
};

type FolderDoc = FirebaseFirestore.DocumentData & {
  services?: string[];
  companyId?: string;
  company?: string;
  pastaId?: string;
  folderId?: string;
  packageId?: string;
  pacoteId?: string;
};

const accessTokensCollection = () =>
  getAdmin().db.collection("accessTokens") as FirebaseFirestore.CollectionReference<AccessTokenData>;
const servicesCollection = () =>
  getAdmin().db.collection("services") as FirebaseFirestore.CollectionReference<FirebaseFirestore.DocumentData>;
const foldersCollection = () =>
  getAdmin().db.collection("packageFolders") as FirebaseFirestore.CollectionReference<FolderDoc>;

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

  const data = snap.data() ?? ({} as AccessTokenData);
  if (data.revoked === true || data.active === false) {
    throw new PublicAccessError(403, "Token inativo");
  }

  const expiresAt = toMillis(data.expiresAt as unknown);
  if (expiresAt && expiresAt < Date.now()) {
    throw new PublicAccessError(403, "Token expirado");
  }

  const record = data as Record<string, unknown>;
  const targetType = typeof data.targetType === "string" ? data.targetType : undefined;
  const targetId = typeof data.targetId === "string" ? data.targetId : undefined;
  const packageId =
    (typeof data.packageId === "string" && data.packageId.trim()) ||
    (typeof data.pacoteId === "string" && data.pacoteId.trim()) ||
    undefined;
  const folderId =
    (typeof record.folderId === "string" && record.folderId.trim()) ||
    (typeof record.pastaId === "string" && record.pastaId.trim()) ||
    (targetType === "folder" && typeof targetId === "string" ? targetId : undefined) ||
    undefined;

  return {
    ...data,
    targetType,
    targetId,
    packageId,
    folderId,
  };
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

function extractFolderId(token: AccessTokenData): string | undefined {
  if (typeof token.folderId === "string" && token.folderId.trim()) return token.folderId.trim();
  if (typeof token.pastaId === "string" && token.pastaId.trim()) return token.pastaId.trim();
  if (token.targetType === "folder" && typeof token.targetId === "string" && token.targetId.trim()) {
    return token.targetId.trim();
  }
  return undefined;
}

async function ensureServiceAllowedByFolder(token: AccessTokenData, serviceId: string) {
  const folderId = extractFolderId(token);
  if (!folderId) {
    throw new PublicAccessError(403, "Token não corresponde à pasta");
  }

  const snap = await foldersCollection().doc(folderId).get();
  if (!snap.exists) {
    throw new PublicAccessError(403, "Pasta não encontrada para este token");
  }

  const data = snap.data() ?? ({} as FolderDoc);
  const services = Array.isArray(data.services)
    ? data.services
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter((value) => value.length > 0)
    : [];

  if (!services.includes(serviceId)) {
    throw new PublicAccessError(403, "Serviço não faz parte desta pasta");
  }

  const tokenCompany = getTokenCompany(token)?.toLowerCase();
  const folderCompany =
    typeof data.companyId === "string" && data.companyId.trim()
      ? data.companyId.trim().toLowerCase()
      : typeof data.company === "string" && data.company.trim()
        ? data.company.trim().toLowerCase()
        : undefined;
  if (tokenCompany && folderCompany && tokenCompany !== folderCompany) {
    throw new PublicAccessError(403, "Token não possui acesso a esta pasta");
  }

  const packageId =
    (typeof data.packageId === "string" && data.packageId.trim()) ||
    (typeof data.pacoteId === "string" && data.pacoteId.trim()) ||
    undefined;

  return { folderId, packageId };
}

export async function requireServiceAccess(
  tokenId: string,
  serviceId: string,
  preloadedToken?: AccessTokenData,
): Promise<{
  token: AccessTokenData;
  service: Service;
  folderId?: string;
}> {
  if (!tokenId) throw new PublicAccessError(400, "Token ausente");
  if (!serviceId) throw new PublicAccessError(400, "serviceId ausente");

  const token = preloadedToken ?? await fetchToken(tokenId);
  let folderContext: { folderId: string; packageId?: string } | null = null;

  if (token.targetType === "service") {
    if (token.targetId !== serviceId) {
      throw new PublicAccessError(403, "Token não corresponde ao serviço");
    }
  } else if (token.targetType === "folder") {
    folderContext = await ensureServiceAllowedByFolder(token, serviceId);
  } else {
    throw new PublicAccessError(403, "Token não corresponde ao serviço");
  }

  const snap = await servicesCollection().doc(serviceId).get();
  if (!snap.exists) {
    throw new PublicAccessError(404, "Serviço não encontrado");
  }

  const data = snap.data() ?? {};
  const statusRaw = typeof data.status === "string" ? data.status.trim().toLowerCase() : "";
  const statusNormalised = statusRaw || "aberto";
  if (statusNormalised !== "aberto") {
    throw new PublicAccessError(403, "Serviço fechado");
  }

  ensureCompanyMatch(token, data);

  if (folderContext?.packageId) {
    const servicePackageId = typeof data.packageId === "string" ? data.packageId.trim() : undefined;
    if (servicePackageId && servicePackageId !== folderContext.packageId) {
      throw new PublicAccessError(403, "Serviço não pertence a esta pasta");
    }
  }

  const service = mapServiceDoc(snap);
  return { token, service, folderId: folderContext?.folderId };
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

export async function resolvePublicAccessRedirect(tokenId: string): Promise<{
  redirectPath: string;
  targetType: "service" | "folder";
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

  if (token.targetType === "folder") {
    const folderId = extractFolderId(token) ?? targetId;
    if (!folderId) {
      throw new PublicAccessError(400, "Token sem pasta configurada");
    }
    const snap = await foldersCollection().doc(folderId).get();
    if (!snap.exists) {
      throw new PublicAccessError(404, "Pasta não encontrada");
    }
    return {
      redirectPath: `/terceiro`,
      targetType: "folder",
      targetId: folderId,
    };
  }

  throw new PublicAccessError(400, "Token sem destino configurado");
}
