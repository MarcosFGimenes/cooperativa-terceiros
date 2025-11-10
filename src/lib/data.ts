import "server-only";
import { getAdminDbOrThrow } from "@/lib/serverDb";

// Normaliza status (aceita "ABERTO", "aberto", etc.)
export function normStatus(s?: string | null) {
  const v = (s ?? "").toString().trim().toLowerCase();
  if (v === "concluido" || v === "concluído" || v === "encerrado") return "Concluído";
  if (v === "pendente") return "Pendente";
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
  const admin = getAdminDbOrThrow();
  const snap = await admin.collection("services").get();
  return snap.docs.map((docSnap) => mapDoc(docSnap.id, docSnap.data() as Record<string, unknown>));
}

/** Lista TODOS os pacotes para o PCM. */
export async function listPackagesPCM() {
  const admin = getAdminDbOrThrow();
  const snap = await admin.collection("packages").get();
  return snap.docs.map((docSnap) => ({
    id: docSnap.id,
    ...(docSnap.data() as Record<string, unknown>),
  }));
}

/** Lista serviços vinculados a um token do Terceiro, tolerante a índices. */
export async function listServicesForToken(tokenDoc: unknown) {
  if (!tokenDoc || typeof tokenDoc !== "object") return [];
  const record = tokenDoc as Record<string, unknown>;
  const admin = getAdminDbOrThrow();

  // Caso 1: token de serviço único
  const serviceId = toOptionalString(record.serviceId);
  if (serviceId) {
    const doc = await admin.collection("services").doc(serviceId).get();
    if (!doc.exists) return [];
    return [mapDoc(doc.id, doc.data() as Record<string, unknown>)].filter(
      (s) => s.status === "Aberto" || s.status === "Pendente",
    );
  }

  // Caso 2: token de pacote + empresa
  // Estratégia sem índice composto: buscar por packageId + empresa (se falhar, buscar apenas por packageId e filtrar em memória).
  const packageId = toOptionalString(record.packageId);
  const empresa = toOptionalString(record.empresa);
  if (packageId && empresa) {
    
    try {
      const q = await admin
        .collection("services")
        .where("packageId", "==", packageId)
        .where("empresa", "==", empresa)
        .get();
      return q.docs
        .map((docSnap) => mapDoc(docSnap.id, docSnap.data() as Record<string, unknown>))
        .filter((s) => s.status === "Aberto" || s.status === "Pendente");
    } catch {
      const q2 = await admin.collection("services").where("packageId", "==", packageId).get();
      return q2.docs
        .map((docSnap) => mapDoc(docSnap.id, docSnap.data() as Record<string, unknown>))
        .filter((s) => s.empresa === empresa && (s.status === "Aberto" || s.status === "Pendente"));
    }
  }

  return [];
}
