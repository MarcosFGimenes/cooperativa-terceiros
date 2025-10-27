import "server-only";
import { tryGetAdminDb, getServerWebDb } from "@/lib/serverDb";

// Normaliza status (aceita "ABERTO", "aberto", etc.)
export function normStatus(s?: string | null) {
  const v = (s ?? "").toString().trim().toLowerCase();
  if (v === "concluido" || v === "concluído") return "Concluído";
  if (v === "encerrado") return "Encerrado";
  return "Aberto";
}

function toOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const parsed = typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

// Mapeia doc -> objeto comum
function mapDoc(id: string, rawData: Record<string, unknown> | undefined) {
  const data = rawData ?? {};
  return {
    id,
    os: toOptionalString(data.os) ?? toOptionalString(data.O_S) ?? toOptionalString(data.OS),
    oc: toOptionalString(data.oc) ?? toOptionalString(data.O_C) ?? toOptionalString(data.OC),
    tag: toOptionalString(data.tag),
    equipamento: toOptionalString(data.equipamento) ?? toOptionalString(data.nomeEquipamento),
    setor: toOptionalString(data.setor),
    status: normStatus(toOptionalString(data.status)),
    andamento: toNumber(data.andamento ?? data.realPercent ?? data.progress),
    packageId: toOptionalString(data.packageId) ?? toOptionalString(data.pacoteId),
    empresa: toOptionalString(data.empresa) ?? toOptionalString(data.empresaId) ?? toOptionalString(data.company),
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

/** Lista TODOS os serviços para o PCM (sem depender de índice; filtra em memória). */
export async function listServicesPCM() {
  const admin = tryGetAdminDb();
  if (admin) {
    const snap = await admin.collection("services").get();
    return snap.docs.map((docSnap) => mapDoc(docSnap.id, docSnap.data() as Record<string, unknown>));
  }
  const db = await getServerWebDb();
  const { collection, getDocs } = await import("firebase/firestore");
  const snap = await getDocs(collection(db, "services"));
  return snap.docs.map((docSnap) => mapDoc(docSnap.id, docSnap.data() as Record<string, unknown>));
}

/** Lista TODOS os pacotes para o PCM. */
export async function listPackagesPCM() {
  const admin = tryGetAdminDb();
  if (admin) {
    const snap = await admin.collection("packages").get();
    return snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Record<string, unknown>),
    }));
  }
  const db = await getServerWebDb();
  const { collection, getDocs } = await import("firebase/firestore");
  const snap = await getDocs(collection(db, "packages"));
  return snap.docs.map((docSnap) => ({
    id: docSnap.id,
    ...(docSnap.data() as Record<string, unknown>),
  }));
}

/** Lista serviços vinculados a um token do Terceiro, tolerante a índices. */
export async function listServicesForToken(tokenDoc: unknown) {
  if (!tokenDoc || typeof tokenDoc !== "object") return [];
  const record = tokenDoc as Record<string, unknown>;
  const admin = tryGetAdminDb();

  // Caso 1: token de serviço único
  const serviceId = toOptionalString(record.serviceId);
  if (serviceId) {
    if (admin) {
      const doc = await admin.collection("services").doc(serviceId).get();
      if (!doc.exists) return [];
      return [mapDoc(doc.id, doc.data() as Record<string, unknown>)].filter((s) => s.status === "Aberto");
    } else {
      const db = await getServerWebDb();
      const { doc, getDoc } = await import("firebase/firestore");
      const dref = doc(db, "services", serviceId);
      const ds = await getDoc(dref);
      if (!ds.exists()) return [];
      return [mapDoc(ds.id, ds.data() as Record<string, unknown>)].filter((s) => s.status === "Aberto");
    }
  }

  // Caso 2: token de pacote + empresa
  // Estratégia sem índice composto: buscar por packageId + empresa (se falhar, buscar apenas por packageId e filtrar em memória).
  const packageId = toOptionalString(record.packageId);
  const empresa = toOptionalString(record.empresa);
  if (packageId && empresa) {
    
    if (admin) {
      try {
        const q = await admin
          .collection("services")
          .where("packageId", "==", packageId)
          .where("empresa", "==", empresa)
          .get();
        return q.docs
          .map((docSnap) => mapDoc(docSnap.id, docSnap.data() as Record<string, unknown>))
          .filter((s) => s.status === "Aberto");
      } catch {
        // fallback: busca por packageId e filtra empresa em memória
        const q2 = await admin.collection("services").where("packageId", "==", packageId).get();
        return q2.docs
          .map((docSnap) => mapDoc(docSnap.id, docSnap.data() as Record<string, unknown>))
          .filter((s) => s.empresa === empresa && s.status === "Aberto");
      }
    } else {
      const db = await getServerWebDb();
      const { collection, getDocs, query, where } = await import("firebase/firestore");
      try {
        const q = query(
          collection(db, "services"),
          where("packageId", "==", packageId),
          where("empresa", "==", empresa),
        );
        const snap = await getDocs(q);
        return snap.docs
          .map((docSnap) => mapDoc(docSnap.id, docSnap.data() as Record<string, unknown>))
          .filter((s) => s.status === "Aberto");
      } catch {
        // fallback: só por packageId
        const q2 = query(collection(db, "services"), where("packageId", "==", packageId));
        const snap2 = await getDocs(q2);
        return snap2.docs
          .map((docSnap) => mapDoc(docSnap.id, docSnap.data() as Record<string, unknown>))
          .filter((s) => s.empresa === empresa && s.status === "Aberto");
      }
    }
  }

  return [];
}
