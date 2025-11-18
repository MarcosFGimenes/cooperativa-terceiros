import "server-only";
import type { FirebaseFirestore } from "firebase-admin";
import { getAdminDbOrThrow } from "@/lib/serverDb";
import type { PCMPackageListItem, PCMListResponse, PCMServiceListItem } from "@/types/pcm";

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
function toTimestamp(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  if (value && typeof value === "object") {
    const source = value as { toMillis?: () => number };
    if (typeof source.toMillis === "function") {
      const millis = source.toMillis();
      if (typeof millis === "number" && Number.isFinite(millis)) {
        return millis;
      }
    }
  }
  return null;
}

function mapDoc(id: string, rawData: Record<string, unknown> | undefined): PCMServiceListItem {
  const data = rawData ?? {};
  return {
    id,
    os: toOptionalString(data.os) ?? toOptionalString(data.O_S) ?? toOptionalString(data.OS),
    oc: toOptionalString(data.oc) ?? toOptionalString(data.O_C) ?? toOptionalString(data.OC),
    tag: toOptionalString(data.tag),
    code: toOptionalString(data.code) ?? toOptionalString(data.codigo),
    equipamento: toOptionalString(data.equipamento) ?? toOptionalString(data.nomeEquipamento),
    equipmentName:
      toOptionalString(data.equipmentName) ??
      toOptionalString(data.nomeEquipamento) ??
      toOptionalString(data.equipamento),
    setor: toOptionalString(data.setor),
    sector: toOptionalString(data.sector) ?? toOptionalString(data.setor),
    status: normStatus(toOptionalString(data.status)),
    andamento: toNumber(data.andamento ?? data.realPercent ?? data.progress),
    progress: toNumber(data.progress),
    realPercent: toNumber(data.realPercent),
    manualPercent: toNumber(data.manualPercent ?? data.manual_percent ?? data.manualProgress),
    packageId: toOptionalString(data.packageId) ?? toOptionalString(data.pacoteId),
    empresa: toOptionalString(data.empresa) ?? toOptionalString(data.empresaId) ?? toOptionalString(data.company),
    company: toOptionalString(data.company) ?? toOptionalString(data.empresa),
    createdAt:
      toTimestamp(data.createdAt ?? data.created_at ?? data.criadoEm ?? data.createdAtMs ?? data.createdAtMillis) ??
      null,
    updatedAt:
      toTimestamp(data.updatedAt ?? data.updated_at ?? data.atualizadoEm ?? data.updatedAtMs ?? data.updatedAtMillis) ??
      null,
    plannedStart: data.plannedStart ?? data.dataInicio ?? data.inicioPlanejado ?? data.startDate ?? null,
    plannedEnd: data.plannedEnd ?? data.dataFim ?? data.fimPlanejado ?? data.endDate ?? null,
    plannedDaily: Array.isArray(data.plannedDaily)
      ? (data.plannedDaily as unknown[]).filter(
          (value): value is number => typeof value === "number" && Number.isFinite(value),
        )
      : null,
  };
}

/** Lista serviços com filtros e paginação para o PCM. */
export async function listServicesPCM(options?: {
  limit?: number;
  cursor?: string | null;
  status?: string | null;
  empresa?: string | null;
}): Promise<PCMListResponse<PCMServiceListItem>> {
  const admin = getAdminDbOrThrow();
  const {
    limit = 10,
    cursor = null,
    status,
    empresa,
  } = options ?? {};

  let query: FirebaseFirestore.Query = admin.collection("services");

  if (status) {
    query = query.where("status", "==", normStatus(status));
  }

  if (empresa) {
    query = query.where("empresa", "==", empresa);
  }

  query = query.orderBy("createdAt", "desc");

  if (cursor) {
    const lastDoc = await admin.collection("services").doc(cursor).get();
    if (lastDoc.exists) {
      query = query.startAfter(lastDoc);
    }
  }

  query = query.limit(limit);

  const snap = await query.get();
  const items = snap.docs.map((docSnap) =>
    mapDoc(docSnap.id, docSnap.data() as Record<string, unknown>),
  );
  const nextCursor = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1].id : null;

  return { items, nextCursor };
}

/** Lista pacotes com paginação para o PCM. */
function mapPackageDoc(id: string, data: Record<string, unknown>): PCMPackageListItem {
  const services = Array.isArray(data.services) ? data.services : undefined;
  const serviceIds = Array.isArray(data.serviceIds) ? data.serviceIds : undefined;
  const servicesCount = typeof data.servicesCount === "number"
    ? data.servicesCount
    : services?.length ?? serviceIds?.length ?? 0;

  return {
    id,
    name: toOptionalString(data.name) ?? toOptionalString(data.nome) ?? `Pacote ${id}`,
    status: normStatus(toOptionalString(data.status)),
    code: toOptionalString(data.code) ?? toOptionalString(data.codigo),
    createdAt:
      toTimestamp(data.createdAt ?? data.created_at ?? data.criadoEm ?? data.createdAtMs ?? data.createdAtMillis) ??
      null,
    servicesCount,
    services,
    serviceIds,
  };
}

export async function listPackagesPCM(options?: {
  limit?: number;
  cursor?: string | null;
}): Promise<PCMListResponse<PCMPackageListItem>> {
  const admin = getAdminDbOrThrow();
  const { limit = 10, cursor = null } = options ?? {};

  let query: FirebaseFirestore.Query = admin.collection("packages");
  query = query.orderBy("createdAt", "desc");

  if (cursor) {
    const lastDoc = await admin.collection("packages").doc(cursor).get();
    if (lastDoc.exists) {
      query = query.startAfter(lastDoc);
    }
  }

  query = query.limit(limit);

  const snap = await query.get();
  const items = snap.docs.map((docSnap) =>
    mapPackageDoc(docSnap.id, (docSnap.data() ?? {}) as Record<string, unknown>),
  );
  const nextCursor = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1].id : null;

  return { items, nextCursor };
}

/** Lista serviços vinculados a um token do Terceiro, tolerante a índices. */
export async function listServicesForToken(tokenDoc: unknown, options?: { limit?: number }) {
  if (!tokenDoc || typeof tokenDoc !== "object") return [];
  const record = tokenDoc as Record<string, unknown>;
  const admin = getAdminDbOrThrow();
  const { limit = 50 } = options ?? {};

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
      // Caso o Firestore solicite um índice composto (packageId + empresa), siga o link exibido no console e registre-o em firestore.indexes.json.
      const q = await admin
        .collection("services")
        .where("packageId", "==", packageId)
        .where("empresa", "==", empresa)
        .limit(limit)
        .get();
      return q.docs
        .map((docSnap) => mapDoc(docSnap.id, docSnap.data() as Record<string, unknown>))
        .filter((s) => s.status === "Aberto" || s.status === "Pendente");
    } catch {
      const q2 = await admin
        .collection("services")
        .where("packageId", "==", packageId)
        .limit(limit)
        .get();
      return q2.docs
        .map((docSnap) => mapDoc(docSnap.id, docSnap.data() as Record<string, unknown>))
        .filter(
          (s) =>
            s.empresa === empresa && (s.status === "Aberto" || s.status === "Pendente"),
        );
    }
  }

  return [];
}
