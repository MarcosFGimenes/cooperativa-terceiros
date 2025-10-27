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

  // Caso 1: token vinculado a 1 serviço
  const serviceId = toOptionalString(t.serviceId);
  if (serviceId) {
    if (adminDb) {
      const doc = await adminDb.collection("services").doc(serviceId).get();
      if (!doc.exists) return [];
      const data = (doc.data() ?? {}) as Record<string, unknown>;
      const mapped = mapServiceDoc(doc.id, data);
      if (mapped.status && mapped.status !== "Aberto") return [];
      return [mapped];
    } else {
      const webDb = await getServerWebDb();
      const { doc, getDoc } = await import("firebase/firestore");
      const dref = doc(webDb, "services", serviceId);
      const ds = await getDoc(dref);
      if (!ds.exists()) return [];
      const data = (ds.data() ?? {}) as Record<string, unknown>;
      const mapped = mapServiceDoc(ds.id, data);
      if (mapped.status && mapped.status !== "Aberto") return [];
      return [mapped];
    }
  }

  // Caso 2: token de pacote + empresa → lista serviços do pacote daquela empresa (status Aberto)
  const packageId = toOptionalString(t.packageId);
  const empresa = toOptionalString(t.empresa);
  if (packageId && empresa) {
    if (adminDb) {
      const snap = await adminDb
        .collection("services")
        .where("packageId", "==", packageId)
        .where("empresa", "==", empresa)
        .where("status", "==", "Aberto")
        .get();
      return snap.docs.map((docSnap) => mapServiceDoc(docSnap.id, (docSnap.data() ?? {}) as Record<string, unknown>));
    } else {
      const webDb = await getServerWebDb();
      const { collection, getDocs, query, where } = await import("firebase/firestore");
      const q = query(
        collection(webDb, "services"),
        where("packageId", "==", packageId),
        where("empresa", "==", empresa),
        where("status", "==", "Aberto"),
      );
      const snap = await getDocs(q);
      return snap.docs.map((docSnap) => mapServiceDoc(docSnap.id, (docSnap.data() ?? {}) as Record<string, unknown>));
    }
  }

  return [];
}
