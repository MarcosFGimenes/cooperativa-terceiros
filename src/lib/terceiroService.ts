// server-only
import "server-only";
import { tryGetAdminDb, getServerWebDb } from "@/lib/serverDb";

type ServiceDoc = {
  id: string;
  os?: string;
  oc?: string;
  tag?: string;
  equipamento?: string;
  setor?: string;
  status?: string;
  andamento?: number;
  packageId?: string | null;
  empresa?: string | null;
};

type TokenDoc = { id: string } & Record<string, unknown>;

function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function normaliseToLower(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase();
}

function isServiceOpen(data: Record<string, unknown>): boolean {
  const status = normaliseToLower(data.status);
  if (!status) return true;
  return status === "aberto" || status === "aberta" || status === "open" || status === "pendente";
}

function matchesCompanyConstraint(data: Record<string, unknown>, company: string | undefined): boolean {
  if (!company) return true;
  const expected = company.trim().toLowerCase();
  if (!expected) return true;

  const candidates = [data.empresa, data.empresaId, data.company, data.companyId];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().toLowerCase() === expected) {
      return true;
    }
  }

  const assigned = data.assignedTo;
  if (assigned && typeof assigned === "object") {
    const assignedRecord = assigned as Record<string, unknown>;
    const assignedCandidates = [assignedRecord.companyId, assignedRecord.company, assignedRecord.companyID];
    for (const candidate of assignedCandidates) {
      if (typeof candidate === "string" && candidate.trim().toLowerCase() === expected) {
        return true;
      }
    }
  }

  return false;
}

function toOptionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function mapServiceDoc(id: string, raw: Record<string, unknown>): ServiceDoc {
  return {
    id,
    os: toOptionalString(raw.os),
    oc: toOptionalString(raw.oc),
    tag: toOptionalString(raw.tag),
    equipamento: toOptionalString(raw.equipamento ?? raw.equipmentName),
    setor: toOptionalString(raw.setor),
    status: toOptionalString(raw.status),
    andamento: toOptionalNumber(raw.andamento ?? raw.progress ?? raw.realPercent),
    packageId: toOptionalString(raw.packageId ?? raw.pacoteId) ?? null,
    empresa: toOptionalString(raw.empresa ?? raw.empresaId ?? raw.company) ?? null,
  };
}

export async function getTokenDoc(token: string) {
  // Tenta Admin
  const adminDb = tryGetAdminDb();
  if (adminDb) {
    const snap = await adminDb.collection("accessTokens").where("code", "==", token).limit(1).get();
    if (snap.empty) return null;
    const d = snap.docs[0];
    const data = d.data() ?? {};
    return { id: d.id, ...(data as Record<string, unknown>) } as TokenDoc;
  }
  // Fallback Web
  const webDb = await getServerWebDb();
  const { collection, getDocs, query, where, limit } = await import("firebase/firestore");
  const q = query(collection(webDb, "accessTokens"), where("code", "==", token), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  const data = d.data() ?? {};
  return { id: d.id, ...(data as Record<string, unknown>) } as TokenDoc;
}

export async function getServicesForToken(token: string): Promise<ServiceDoc[]> {
  const t = await getTokenDoc(token);
  if (!t) return [];
  const adminDb = tryGetAdminDb();
  const tokenCompany =
    toOptionalString(t.empresa) ??
    toOptionalString((t as Record<string, unknown>).empresaId) ??
    toOptionalString((t as Record<string, unknown>).company) ??
    toOptionalString((t as Record<string, unknown>).companyId);

  // Caso 1: token vinculado a 1 serviço
  const serviceId = toOptionalString(t.serviceId);
  if (serviceId) {
    if (adminDb) {
      const doc = await adminDb.collection("services").doc(serviceId).get();
      if (!doc.exists) return [];
      const data = (doc.data() ?? {}) as Record<string, unknown>;
      if (!isServiceOpen(data)) return [];
      return [mapServiceDoc(doc.id, data)];
    } else {
      const webDb = await getServerWebDb();
      const { doc, getDoc } = await import("firebase/firestore");
      const dref = doc(webDb, "services", serviceId);
      const ds = await getDoc(dref);
      if (!ds.exists()) return [];
      const data = (ds.data() ?? {}) as Record<string, unknown>;
      if (!isServiceOpen(data)) return [];
      return [mapServiceDoc(ds.id, data)];
    }
  }

  // Caso 2: token de pacote + empresa → lista serviços do pacote daquela empresa (status Aberto)
  const folderId =
    toOptionalString((t as Record<string, unknown>).folderId) ??
    toOptionalString((t as Record<string, unknown>).pastaId);
  if (folderId) {
    if (adminDb) {
      return getServicesForFolderAdmin(adminDb, folderId, tokenCompany);
    }
    return getServicesForFolderWeb(folderId, tokenCompany);
  }

  return [];
}

async function getServicesForFolderAdmin(
  adminDb: FirebaseFirestore.Firestore,
  folderId: string,
  empresa: string | null,
): Promise<ServiceDoc[]> {
  const folderSnap = await adminDb.collection("packageFolders").doc(folderId).get();
  if (!folderSnap.exists) return [];

  const folderData = (folderSnap.data() ?? {}) as Record<string, unknown>;
  const folderCompany = normaliseToLower(folderData.companyId ?? folderData.company ?? folderData.empresa);
  const expectedCompany = normaliseToLower(empresa);
  if (expectedCompany && folderCompany && folderCompany !== expectedCompany) {
    return [];
  }

  const serviceIds = Array.isArray(folderData.services)
    ? (folderData.services as unknown[])
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter((value) => value.length > 0)
    : [];

  if (!serviceIds.length) return [];

  const services: ServiceDoc[] = [];
  for (const serviceId of serviceIds) {
    const snap = await adminDb.collection("services").doc(serviceId).get();
    if (!snap.exists) continue;
    const data = (snap.data() ?? {}) as Record<string, unknown>;
    if (!isServiceOpen(data)) continue;
    if (!matchesCompanyConstraint(data, empresa ?? undefined)) continue;
    services.push(mapServiceDoc(snap.id, data));
  }

  return services;
}

async function getServicesForFolderWeb(folderId: string, empresa: string | null): Promise<ServiceDoc[]> {
  const webDb = await getServerWebDb();
  const { collection, doc, getDoc } = await import("firebase/firestore");

  const folderRef = doc(collection(webDb, "packageFolders"), folderId);
  const folderSnap = await getDoc(folderRef);
  if (!folderSnap.exists()) return [];

  const folderData = (folderSnap.data() ?? {}) as Record<string, unknown>;
  const folderCompany = normaliseToLower(folderData.companyId ?? folderData.company ?? folderData.empresa);
  const expectedCompany = normaliseToLower(empresa);
  if (expectedCompany && folderCompany && folderCompany !== expectedCompany) {
    return [];
  }

  const serviceIds = Array.isArray(folderData.services)
    ? (folderData.services as unknown[])
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter((value) => value.length > 0)
    : [];

  if (!serviceIds.length) return [];

  const services: ServiceDoc[] = [];
  for (const serviceId of serviceIds) {
    const serviceRef = doc(collection(webDb, "services"), serviceId);
    const serviceSnap = await getDoc(serviceRef);
    if (!serviceSnap.exists()) continue;
    const data = (serviceSnap.data() ?? {}) as Record<string, unknown>;
    if (!isServiceOpen(data)) continue;
    if (!matchesCompanyConstraint(data, empresa ?? undefined)) continue;
    services.push(mapServiceDoc(serviceSnap.id, data));
  }

  return services;
}
