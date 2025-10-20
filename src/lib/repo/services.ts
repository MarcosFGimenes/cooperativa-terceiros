import { db } from "@/lib/firebase";
import { getAdmin } from "@/lib/firebaseAdmin";
import type {
  ChecklistItem,
  Service,
  ServiceStatus,
  ServiceUpdate,
} from "@/lib/types";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  type DocumentData,
} from "firebase/firestore";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

const getDb = () => getAdmin().db;
const servicesCollection = () => getDb().collection("services");

function toMillis(value: unknown | Timestamp | number | null | undefined) {
  if (typeof value === "number") return value;
  if (!value) return undefined;
  const ts = value as Timestamp | { toMillis?: () => number };
  if (typeof ts?.toMillis === "function") return ts.toMillis();
  return undefined;
}

function inferChecklistStatus(progress: number): ChecklistItem["status"] {
  if (progress >= 100) return "concluido";
  if (progress > 0) return "andamento";
  return "nao_iniciado";
}

function sanitisePercent(value: number) {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, value));
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
    plannedDaily: Array.isArray(data.plannedDaily)
      ? data.plannedDaily.map((value: unknown) => {
          const numeric = typeof value === "number" ? value : Number(value);
          return Number.isFinite(numeric) ? numeric : 0;
        })
      : undefined,
    status: (data.status ?? "aberto") as ServiceStatus,
    company: data.company ?? undefined,
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
    hasChecklist: data.hasChecklist ?? false,
    realPercent: data.realPercent ?? 0,
    packageId: data.packageId ?? undefined,
  };
}

function normaliseServiceStatus(value: unknown): ServiceStatus {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "concluido" || raw === "concluído") return "Concluído";
  if (raw === "encerrado") return "Encerrado";
  return "Aberto";
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (typeof value === "object" && value && "toMillis" in value) {
    const possible = (value as { toMillis?: () => number }).toMillis?.();
    if (typeof possible === "number" && Number.isFinite(possible)) return possible;
  }
  return undefined;
}

function mapChecklistItemData(data: Record<string, unknown>): ChecklistItem {
  const rawStatus = String(data.status ?? data.situacao ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .replace("em andamento", "em-andamento");

  const status: ChecklistItem["status"] = ((): ChecklistItem["status"] => {
    if (rawStatus === "em-andamento" || rawStatus === "andamento") return "em-andamento";
    if (rawStatus === "concluido" || rawStatus === "concluído") return "concluido";
    return "nao-iniciado";
  })();

  return {
    id: String(data.id ?? data.itemId ?? data.checklistId ?? crypto.randomUUID()),
    description: String(data.description ?? data.descricao ?? ""),
    weight: toNumber(data.weight ?? data.peso) ?? 0,
    progress: toNumber(data.progress ?? data.percentual ?? data.pct) ?? 0,
    status,
  };
}

function mapUpdateData(data: Record<string, unknown>): ServiceUpdate {
  const percent = toNumber(
    data.percent ?? data.manualPercent ?? data.totalPct ?? data.realPercentSnapshot ?? data.pct,
  );

  return {
    id: String(data.id ?? crypto.randomUUID()),
    createdAt:
      toNumber(data.createdAt ?? data.date ?? data.created_at ?? data.timestamp) ?? Date.now(),
    description: String(data.description ?? data.note ?? data.observacao ?? ""),
    percent: percent ?? undefined,
  };
}

function mapServiceData(id: string, data: Record<string, unknown>): Service {
  const plannedStart = String(
    data.plannedStart ?? data.inicioPlanejado ?? data.dataInicio ?? data.startDate ?? "",
  );
  const plannedEnd = String(
    data.plannedEnd ?? data.fimPlanejado ?? data.dataFim ?? data.endDate ?? "",
  );
  const totalHours =
    toNumber(data.totalHours ?? data.totalHoras ?? data.horasTotais ?? data.hours) ?? 0;
  const createdAt =
    toNumber(data.createdAt ?? data.created_at ?? data.criadoEm ?? data.createdAtMs) ?? Date.now();

  const assignedRaw = data.assignedTo;
  let assignedTo: Service["assignedTo"] | undefined;
  if (assignedRaw && typeof assignedRaw === "object") {
    const companyId = (assignedRaw as Record<string, unknown>).companyId;
    const companyName = (assignedRaw as Record<string, unknown>).companyName;
    if (companyId || companyName) {
      assignedTo = {
        companyId: companyId ? String(companyId) : undefined,
        companyName: companyName ? String(companyName) : undefined,
      };
    }
  }

  if (!assignedTo) {
    const companyId = data.companyId ?? data.empresaId ?? data.company ?? data.empresa;
    const companyName = data.companyName ?? data.empresaNome ?? data.nomeEmpresa;
    if (companyId || companyName) {
      assignedTo = {
        companyId: companyId ? String(companyId) : undefined,
        companyName: companyName ? String(companyName) : undefined,
      };
    }
  }

  const checklist = Array.isArray(data.checklist)
    ? (data.checklist as Record<string, unknown>[]).map((item) => mapChecklistItemData(item))
    : undefined;

  const updates = Array.isArray(data.updates)
    ? (data.updates as Record<string, unknown>[]).map((item) => mapUpdateData(item))
    : undefined;

  const progress = toNumber(
    data.progress ?? data.realPercent ?? data.andamento ?? data.percentual ?? data.percent,
  );

  return {
    id,
    os: String(data.os ?? data.OS ?? data.ordemServico ?? id ?? ""),
    oc: data.oc ? String(data.oc) : undefined,
    tag: data.tag ? String(data.tag) : undefined,
    equipmentName: String(data.equipmentName ?? data.equipamento ?? data.equipment ?? ""),
    setor: data.setor ? String(data.setor) : undefined,
    sector: data.sector ? String(data.sector) : undefined,
    plannedStart,
    plannedEnd,
    totalHours,
    status: normaliseServiceStatus(data.status),
    code: data.code ? String(data.code) : data.codigo ? String(data.codigo) : undefined,
    assignedTo,
    progress: progress ?? undefined,
    updates,
    checklist,
    createdAt,
    packageId: data.packageId ? String(data.packageId) : data.pacoteId ? String(data.pacoteId) : undefined,
    company: data.company ? String(data.company) : data.companyId ? String(data.companyId) : undefined,
    empresa: data.empresa ? String(data.empresa) : undefined,
    andamento: progress ?? undefined,
    realPercent: progress ?? undefined,
  };
}

export async function getServiceById(id: string): Promise<Service | null> {
  const snap = await getDoc(doc(db, "services", id));
  if (!snap.exists()) return null;
  return mapServiceData(snap.id, snap.data() as DocumentData);
}

export async function listRecentServices(): Promise<Service[]> {
  const q = query(collection(db, "services"), orderBy("createdAt", "desc"), limit(20));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapServiceData(d.id, d.data()));
}

function mapChecklistDoc(
  serviceId: string,
  doc: FirebaseFirestore.QueryDocumentSnapshot,
): ChecklistItem {
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
}

function mapUpdateDoc(
  serviceId: string,
  doc: FirebaseFirestore.QueryDocumentSnapshot,
): ServiceUpdate {
  const data = doc.data() ?? {};
  return {
    id: doc.id,
    serviceId,
    token: data.token ?? undefined,
    note: data.note ?? undefined,
    manualPercent: data.manualPercent ?? undefined,
    realPercentSnapshot: data.realPercentSnapshot ?? 0,
    createdAt: toMillis(data.createdAt) ?? 0,
  };
}

export async function getService(serviceId: string): Promise<Service | null> {
  const snap = await servicesCollection().doc(serviceId).get();
  if (!snap.exists) return null;
  return mapServiceDoc(snap);
}

export async function getChecklist(
  serviceId: string,
): Promise<ChecklistItem[]> {
  const col = servicesCollection().doc(serviceId).collection("checklist");
  const snap = await col.orderBy("description", "asc").get();
  return snap.docs.map((doc) => mapChecklistDoc(serviceId, doc));
}

export async function setChecklistItems(
  serviceId: string,
  items: Array<{ description: string; weight: number }>,
): Promise<void> {
  const totalWeight = items.reduce((acc, item) => acc + (item.weight ?? 0), 0);
  if (Math.round(totalWeight) !== 100) {
    throw new Error("A soma dos pesos do checklist deve ser igual a 100.");
  }

  const { db } = getAdmin();
  await db.runTransaction(async (tx) => {
    const serviceRef = servicesCollection().doc(serviceId);
    const checklistCol = serviceRef.collection("checklist");

    const serviceSnap = await tx.get(serviceRef);
    if (!serviceSnap.exists) {
      throw new Error("Serviço não encontrado");
    }

    const existing = await tx.get(checklistCol);
    existing.docs.forEach((doc) => {
      tx.delete(doc.ref);
    });

    items.forEach((item) => {
      const ref = checklistCol.doc();
      tx.set(ref, {
        description: item.description,
        weight: item.weight,
        progress: 0,
        status: "nao_iniciado",
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    tx.update(serviceRef, {
      hasChecklist: items.length > 0,
      realPercent: 0,
      manualPercent: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

export async function updateChecklistProgress(
  serviceId: string,
  updates: Array<{
    id: string;
    progress: number;
    status?: ChecklistItem["status"];
  }>,
): Promise<number> {
  if (!updates.length) {
    return computeRealPercentFromChecklist(serviceId);
  }

  const { db } = getAdmin();
  const newPercent = await db.runTransaction(async (tx) => {
    const serviceRef = servicesCollection().doc(serviceId);
    const checklistCol = serviceRef.collection("checklist");

    const serviceSnap = await tx.get(serviceRef);
    if (!serviceSnap.exists) {
      throw new Error("Serviço não encontrado");
    }

    const checklistSnap = await tx.get(checklistCol);
    const itemsMap = new Map<string, ChecklistItem>();

    checklistSnap.docs.forEach((doc) => {
      itemsMap.set(doc.id, mapChecklistDoc(serviceId, doc));
    });

    updates.forEach((update) => {
      const existing = itemsMap.get(update.id);
      if (!existing) {
        throw new Error(`Item do checklist ${update.id} não encontrado.`);
      }
      const progress = sanitisePercent(update.progress);
      const status = update.status ?? inferChecklistStatus(progress);
      itemsMap.set(update.id, { ...existing, progress, status });

      tx.update(checklistCol.doc(update.id), {
        progress,
        status,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    const items = Array.from(itemsMap.values());
    const totalWeight = items.reduce((acc, item) => acc + (item.weight ?? 0), 0);
    const percent = totalWeight
      ? items.reduce(
          (acc, item) => acc + (item.progress ?? 0) * (item.weight ?? 0),
          0,
        ) / totalWeight
      : 0;
    const realPercent = Math.round(percent * 100) / 100;

    tx.update(serviceRef, {
      realPercent,
      manualPercent: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return realPercent;
  });

  return newPercent;
}

export async function computeRealPercentFromChecklist(
  serviceId: string,
): Promise<number> {
  const checklistCol = servicesCollection().doc(serviceId).collection("checklist");
  const snap = await checklistCol.get();
  if (snap.empty) return 0;

  const items = snap.docs.map((doc) => mapChecklistDoc(serviceId, doc));
  const totalWeight = items.reduce((acc, item) => acc + (item.weight ?? 0), 0);
  if (!totalWeight) return 0;

  const percent =
    items.reduce(
      (acc, item) => acc + (item.progress ?? 0) * (item.weight ?? 0),
      0,
    ) / totalWeight;
  return Math.round(percent * 100) / 100;
}

function buildUpdatePayload(params: {
  note?: string;
  token?: string;
  manualPercent?: number;
  realPercent: number;
}) {
  const payload: Record<string, unknown> = {
    realPercentSnapshot: params.realPercent,
    createdAt: FieldValue.serverTimestamp(),
  };
  if (params.note !== undefined) payload.note = params.note;
  if (params.token !== undefined) payload.token = params.token;
  if (params.manualPercent !== undefined) {
    payload.manualPercent = params.manualPercent;
  }
  return payload;
}

export async function addManualUpdate(
  serviceId: string,
  manualPercent: number,
  note?: string,
  token?: string,
): Promise<string> {
  const percent = sanitisePercent(manualPercent);
  const { db } = getAdmin();
  const updateId = await db.runTransaction(async (tx) => {
    const serviceRef = servicesCollection().doc(serviceId);
    const updatesCol = serviceRef.collection("updates");

    const serviceSnap = await tx.get(serviceRef);
    if (!serviceSnap.exists) {
      throw new Error("Serviço não encontrado");
    }

    const updateRef = updatesCol.doc();
    tx.set(
      updateRef,
      buildUpdatePayload({
        note,
        token,
        manualPercent: percent,
        realPercent: percent,
      }),
    );

    tx.update(serviceRef, {
      realPercent: percent,
      manualPercent: percent,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return updateRef.id;
  });

  return updateId;
}

export async function addComputedUpdate(
  serviceId: string,
  realPercent: number,
  note?: string,
  token?: string,
): Promise<string> {
  const percent = sanitisePercent(realPercent);
  const { db } = getAdmin();
  const updateId = await db.runTransaction(async (tx) => {
    const serviceRef = servicesCollection().doc(serviceId);
    const updatesCol = serviceRef.collection("updates");

    const serviceSnap = await tx.get(serviceRef);
    if (!serviceSnap.exists) {
      throw new Error("Serviço não encontrado");
    }

    const updateRef = updatesCol.doc();
    tx.set(
      updateRef,
      buildUpdatePayload({
        note,
        token,
        realPercent: percent,
      }),
    );

    tx.update(serviceRef, {
      realPercent: percent,
      manualPercent: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return updateRef.id;
  });

  return updateId;
}

export async function listUpdates(
  serviceId: string,
  limit = 50,
): Promise<ServiceUpdate[]> {
  const updatesCol = servicesCollection().doc(serviceId).collection("updates");
  const snap = await updatesCol
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((doc) => mapUpdateDoc(serviceId, doc));
}

export async function listServices(filter?: {
  status?: ServiceStatus;
  company?: string;
  packageId?: string;
}): Promise<Service[]> {
  let query: FirebaseFirestore.Query = servicesCollection();
  if (filter?.status) {
    query = query.where("status", "==", filter.status);
  }
  if (filter?.company) {
    query = query.where("company", "==", filter.company);
  }
  if (filter?.packageId) {
    query = query.where("packageId", "==", filter.packageId);
  }
  query = query.orderBy("createdAt", "desc");
  const snap = await query.get();
  return snap.docs.map((doc) => mapServiceDoc(doc));
}
