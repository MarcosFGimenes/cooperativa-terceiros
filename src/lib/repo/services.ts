import { getAdmin } from "@/lib/firebaseAdmin";
import type {
  ChecklistItem,
  Service,
  ServiceStatus,
  ServiceUpdate,
} from "@/lib/types";
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

function toIsoDate(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  }
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  }
  const possible = value as { toDate?: () => Date; toMillis?: () => number };
  if (typeof possible?.toDate === "function") {
    const date = possible.toDate();
    return !date || Number.isNaN(date.getTime()) ? "" : date.toISOString();
  }
  if (typeof possible?.toMillis === "function") {
    const millis = possible.toMillis();
    if (typeof millis === "number" && Number.isFinite(millis)) {
      const date = new Date(millis);
      return Number.isNaN(date.getTime()) ? "" : date.toISOString();
    }
  }
  return "";
}

function pickDateField(
  data: Record<string, unknown>,
  candidates: string[],
): string {
  for (const key of candidates) {
    if (!(key in data)) continue;
    const value = toIsoDate(data[key]);
    if (value) return value;
  }
  return "";
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
  const data = (doc.data() ?? {}) as Record<string, unknown>;
  const plannedStart = pickDateField(data, [
    "plannedStart",
    "inicioPrevisto",
    "inicioPlanejado",
    "dataInicio",
    "startDate",
  ]);
  const plannedEnd = pickDateField(data, [
    "plannedEnd",
    "fimPrevisto",
    "fimPlanejado",
    "dataFim",
    "endDate",
  ]);
  const totalHours =
    toNumber(
      data.totalHours ??
        data.totalHoras ??
        data.horasTotais ??
        data.horasPrevistas ??
        data.hours,
    ) ?? 0;

  return {
    id: doc.id,
    os: String(data.os ?? ""),
    oc: data.oc ? String(data.oc) : undefined,
    tag: String(data.tag ?? ""),
    equipmentName: String(data.equipmentName ?? data.equipamento ?? ""),
    sector: String(data.sector ?? data.setor ?? ""),
    plannedStart,
    plannedEnd,
    totalHours,
    plannedDaily: Array.isArray(data.plannedDaily)
      ? data.plannedDaily.map((value: unknown) => {
          const numeric = typeof value === "number" ? value : Number(value);
          return Number.isFinite(numeric) ? numeric : 0;
        })
      : undefined,
    status: normaliseServiceStatus(data.status),
    company:
      data.company !== undefined && data.company !== null
        ? String(data.company)
        : data.empresaId !== undefined && data.empresaId !== null
          ? String(data.empresaId)
          : undefined,
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
    hasChecklist: data.hasChecklist ?? Array.isArray(data.checklist),
    realPercent: toNumber(data.realPercent ?? data.andamento) ?? 0,
    previousProgress: toNumber((data as Record<string, unknown>).previousProgress) ?? null,
    packageId:
      data.packageId !== undefined && data.packageId !== null
        ? String(data.packageId)
        : data.pacoteId !== undefined && data.pacoteId !== null
          ? String(data.pacoteId)
          : undefined,
  };
}

function normaliseServiceStatus(value: unknown): ServiceStatus {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "concluido" || raw === "concluído" || raw === "encerrado") return "Concluído";
  if (raw === "pendente") return "Pendente";
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
  const plannedStart = pickDateField(data, [
    "plannedStart",
    "inicioPrevisto",
    "inicioPlanejado",
    "dataInicio",
    "startDate",
  ]);
  const plannedEnd = pickDateField(data, [
    "plannedEnd",
    "fimPrevisto",
    "fimPlanejado",
    "dataFim",
    "endDate",
  ]);
  const totalHours =
    toNumber(
      data.totalHours ?? data.totalHoras ?? data.horasTotais ?? data.horasPrevistas ?? data.hours,
    ) ?? 0;
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
  const snap = await servicesCollection().doc(id).get();
  if (!snap.exists) return null;
  return mapServiceData(snap.id, (snap.data() ?? {}) as Record<string, unknown>);
}

export async function listRecentServices(): Promise<Service[]> {
  const snap = await servicesCollection().orderBy("createdAt", "desc").limit(20).get();
  return snap.docs.map((doc) => mapServiceData(doc.id, (doc.data() ?? {}) as Record<string, unknown>));
}

export async function listAvailableOpenServices(limit = 200): Promise<Service[]> {
  const safeLimit = Math.max(1, Math.min(limit, 500));
  const allowedStatuses: ServiceStatus[] = ["Aberto", "Pendente"];
  const allowedStatusSet = new Set<ServiceStatus>(allowedStatuses);
  const seen = new Set<string>();
  const results: Service[] = [];

  const pushDocs = (docs: FirebaseFirestore.QueryDocumentSnapshot[]) => {
    for (const doc of docs) {
      if (results.length >= safeLimit) break;
      if (seen.has(doc.id)) continue;
      const service = mapServiceData(doc.id, (doc.data() ?? {}) as Record<string, unknown>);
      if (!allowedStatusSet.has(service.status)) continue;
      if (service.packageId && service.packageId.trim().length > 0) continue;
      seen.add(service.id);
      results.push(service);
      if (results.length >= safeLimit) break;
    }
  };

  const baseLimit = safeLimit * 2;

  const unassignedQueries: Array<Promise<FirebaseFirestore.QuerySnapshot>> = [
    servicesCollection().where("packageId", "==", null).limit(baseLimit).get(),
    servicesCollection().where("packageId", "==", "").limit(baseLimit).get(),
  ];

  let unassignedError: unknown = null;

  for (const queryPromise of unassignedQueries) {
    if (results.length >= safeLimit) break;
    try {
      const snapshot = await queryPromise;
      pushDocs(snapshot.docs);
    } catch (error) {
      if (!unassignedError) {
        unassignedError = error;
      }
    }
  }

  if (results.length === 0 && unassignedError) {
    throw unassignedError;
  }

  if (results.length < safeLimit) {
    const statusCandidates = ["Aberto", "aberto", "ABERTO", "Pendente", "pendente", "PENDENTE"];
    for (const status of statusCandidates) {
      if (results.length >= safeLimit) break;
      try {
        const snapshot = await servicesCollection().where("status", "==", status).limit(baseLimit).get();
        pushDocs(snapshot.docs);
      } catch (error) {
        // Ignore status-specific query failures (e.g., missing indexes) and continue with remaining fallbacks.
        if (results.length === 0) {
          throw error;
        }
      }
    }
  }

  results.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

  return results.slice(0, safeLimit);
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

function mapTimeWindow(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const start = toMillis(record.start);
  const end = toMillis(record.end);
  const hours = toNumber(record.hours);
  return {
    start: start ?? null,
    end: end ?? null,
    hours: Number.isFinite(hours ?? NaN) ? Number(hours) : start && end ? (end - start) / 3_600_000 : null,
  };
}

function mapSubactivity(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" && record.id.trim() ? record.id.trim() : null;
  const label = typeof record.label === "string" && record.label.trim() ? record.label.trim() : null;
  if (!id && !label) return undefined;
  return { id, label };
}

function mapImpediments(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const entries = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const type = typeof record.type === "string" ? record.type.trim() : "";
      if (!type) return null;
      const duration = toNumber(record.durationHours);
      return {
        type,
        durationHours: Number.isFinite(duration ?? NaN) ? Number(duration) : null,
      };
    })
    .filter(Boolean) as Array<{ type: string; durationHours?: number | null }>;
  return entries.length ? entries : undefined;
}

function mapResources(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const entries = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const name = typeof record.name === "string" ? record.name.trim() : "";
      if (!name) return null;
      const quantity = toNumber(record.quantity);
      const numericQuantity = Number.isFinite(quantity ?? NaN) ? Number(quantity) : null;
      const unit = typeof record.unit === "string" && record.unit.trim() ? record.unit.trim() : null;
      return {
        name,
        quantity: numericQuantity && numericQuantity > 0 ? numericQuantity : null,
        unit,
      };
    })
    .filter(Boolean) as Array<{ name: string; quantity?: number | null; unit?: string | null }>;
  return entries.length ? entries : undefined;
}

function mapWorkforce(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const entries = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const role = typeof record.role === "string" ? record.role.trim() : "";
      if (!role) return null;
      const quantity = toNumber(record.quantity);
      const normalisedQuantity = Number.isFinite(quantity ?? NaN) ? Math.max(1, Math.round(Number(quantity))) : null;
      if (!normalisedQuantity) return null;
      return { role, quantity: normalisedQuantity };
    })
    .filter(Boolean) as Array<{ role: string; quantity: number }>;
  return entries.length ? entries : undefined;
}

const SHIFT_VALUES = new Set(["manha", "tarde", "noite"]);
const WEATHER_VALUES = new Set(["claro", "nublado", "chuvoso"]);
const CONDITION_VALUES = new Set(["praticavel", "impraticavel"]);

function mapShiftConditions(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const entries = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const shiftRaw = typeof record.shift === "string" ? record.shift.trim().toLowerCase() : "";
      const weatherRaw = typeof record.weather === "string" ? record.weather.trim().toLowerCase() : "";
      const conditionRaw = typeof record.condition === "string" ? record.condition.trim().toLowerCase() : "";
      if (!SHIFT_VALUES.has(shiftRaw) || !WEATHER_VALUES.has(weatherRaw) || !CONDITION_VALUES.has(conditionRaw)) {
        return null;
      }
      return {
        shift: shiftRaw as "manha" | "tarde" | "noite",
        weather: weatherRaw as "claro" | "nublado" | "chuvoso",
        condition: conditionRaw as "praticavel" | "impraticavel",
      };
    })
    .filter(Boolean) as Array<{
      shift: "manha" | "tarde" | "noite";
      weather: "claro" | "nublado" | "chuvoso";
      condition: "praticavel" | "impraticavel";
    }>;
  return entries.length ? entries : undefined;
}

function mapEvidences(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const entries = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const url = typeof record.url === "string" ? record.url.trim() : "";
      if (!url) return null;
      const label = typeof record.label === "string" && record.label.trim() ? record.label.trim() : null;
      return { url, label };
    })
    .filter(Boolean) as Array<{ url: string; label?: string | null }>;
  return entries.length ? entries : undefined;
}

function mapAudit(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const submittedAt = toMillis(record.submittedAt);
  const previousPercent = toNumber(record.previousPercent);
  const newPercent = toNumber(record.newPercent);
  const submittedBy = typeof record.submittedBy === "string" && record.submittedBy.trim() ? record.submittedBy.trim() : null;
  const token = typeof record.token === "string" && record.token.trim() ? record.token.trim() : null;
  const ip = typeof record.ip === "string" && record.ip.trim() ? record.ip.trim() : null;
  const submittedByType = typeof record.submittedByType === "string" ? record.submittedByType : undefined;
  return {
    submittedBy,
    submittedByType: submittedByType === "user" || submittedByType === "token" || submittedByType === "system"
      ? submittedByType
      : undefined,
    submittedAt: submittedAt ?? null,
    previousPercent: Number.isFinite(previousPercent ?? NaN) ? Number(previousPercent) : null,
    newPercent: Number.isFinite(newPercent ?? NaN) ? Number(newPercent) : null,
    token,
    ip,
  };
}

function mapUpdateDoc(
  serviceId: string,
  doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot,
): ServiceUpdate {
  const data = doc.data() ?? {};
  const manualPercent = toNumber((data as Record<string, unknown>).manualPercent) ?? undefined;
  const realPercent = toNumber((data as Record<string, unknown>).realPercentSnapshot) ?? manualPercent ?? 0;
  const description = (() => {
    const raw = (data as Record<string, unknown>).description ?? (data as Record<string, unknown>).note;
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      return trimmed.length ? trimmed : "";
    }
    return "";
  })();
  const percent = Number.isFinite(realPercent ?? NaN) ? Number(realPercent) : 0;

  return {
    id: doc.id,
    serviceId,
    token: (data as Record<string, unknown>).token ?? undefined,
    manualPercent,
    realPercentSnapshot: percent,
    percent,
    description,
    timeWindow: mapTimeWindow((data as Record<string, unknown>).timeWindow),
    subactivity: mapSubactivity((data as Record<string, unknown>).subactivity),
    mode:
      (typeof (data as Record<string, unknown>).mode === "string" &&
      ((data as Record<string, unknown>).mode === "detailed" || (data as Record<string, unknown>).mode === "simple"))
        ? ((data as Record<string, unknown>).mode as "simple" | "detailed")
        : undefined,
    impediments: mapImpediments((data as Record<string, unknown>).impediments),
    resources: mapResources((data as Record<string, unknown>).resources),
    workforce: mapWorkforce((data as Record<string, unknown>).workforce),
    shiftConditions: mapShiftConditions((data as Record<string, unknown>).shiftConditions),
    forecastDate: toMillis((data as Record<string, unknown>).forecastDate) ?? null,
    criticality: toNumber((data as Record<string, unknown>).criticality) ?? null,
    evidences: mapEvidences((data as Record<string, unknown>).evidences),
    justification:
      typeof (data as Record<string, unknown>).justification === "string"
        ? (data as Record<string, unknown>).justification.trim() || null
        : null,
    previousPercent: toNumber((data as Record<string, unknown>).previousPercent) ?? null,
    declarationAccepted:
      typeof (data as Record<string, unknown>).declarationAccepted === "boolean"
        ? (data as Record<string, unknown>).declarationAccepted
        : undefined,
    audit: mapAudit((data as Record<string, unknown>).audit),
    createdAt: toMillis((data as Record<string, unknown>).createdAt) ?? 0,
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
  if (items.length > 0 && Math.round(totalWeight) !== 100) {
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

type ServiceMetadataInput = {
  os: string;
  tag: string;
  equipment: string;
  oc?: string | null;
  sector?: string | null;
  company?: string | null;
  plannedStart: string;
  plannedEnd: string;
  totalHours: number;
  status: ServiceStatus;
};

function toDateOnlyTimestamp(value: string): Timestamp {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Data inválida.");
  }
  return Timestamp.fromDate(date);
}

export async function updateServiceMetadata(serviceId: string, input: ServiceMetadataInput): Promise<void> {
  const ref = servicesCollection().doc(serviceId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error("Serviço não encontrado");
  }

  const plannedStartTimestamp = toDateOnlyTimestamp(input.plannedStart);
  const plannedEndTimestamp = toDateOnlyTimestamp(input.plannedEnd);

  const payload: Record<string, unknown> = {
    os: input.os,
    tag: input.tag,
    equipamento: input.equipment,
    equipmentName: input.equipment,
    updatedAt: FieldValue.serverTimestamp(),
    inicioPrevisto: plannedStartTimestamp,
    fimPrevisto: plannedEndTimestamp,
    plannedStart: input.plannedStart,
    plannedEnd: input.plannedEnd,
    dataInicio: input.plannedStart,
    dataFim: input.plannedEnd,
    inicioPlanejado: input.plannedStart,
    fimPlanejado: input.plannedEnd,
    horasPrevistas: input.totalHours,
    totalHours: input.totalHours,
    totalHoras: input.totalHours,
    status: input.status,
  };

  payload.oc = input.oc ?? null;
  payload.sector = input.sector ?? null;
  payload.setor = input.sector ?? null;
  payload.empresaId = input.company ?? null;
  payload.company = input.company ?? null;

  await ref.update(payload);
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

type ManualUpdateInput = {
  manualPercent: number;
  description: string;
  token?: string;
  mode: "simple" | "detailed";
  declarationAccepted: boolean;
  timeWindow?: { start?: number | null; end?: number | null; hours?: number | null };
  subactivity?: { id?: string | null; label?: string | null };
  impediments?: Array<{ type: string; durationHours?: number | null }>;
  resources?: Array<{ name: string; quantity?: number | null; unit?: string | null }>;
  workforce?: Array<{ role: string; quantity: number }>;
  shiftConditions?: Array<{
    shift: "manha" | "tarde" | "noite";
    weather: "claro" | "nublado" | "chuvoso";
    condition: "praticavel" | "impraticavel";
  }>;
  forecastDate?: number | null;
  criticality?: number | null;
  evidences?: Array<{ url: string; label?: string | null }>;
  justification?: string | null;
  previousPercent?: number | null;
  ip?: string | null;
};

function buildComputedUpdatePayload(params: { realPercent: number; note?: string; token?: string }) {
  const payload: Record<string, unknown> = {
    realPercentSnapshot: params.realPercent,
    createdAt: FieldValue.serverTimestamp(),
  };

  if (typeof params.note === "string" && params.note.trim()) {
    payload.note = params.note.trim();
  }

  if (params.token) {
    payload.token = params.token;
  }

  return payload;
}

function buildUpdatePayload(serviceId: string, params: ManualUpdateInput & { realPercent: number }) {
  const payload: Record<string, unknown> = {
    realPercentSnapshot: params.realPercent,
    createdAt: FieldValue.serverTimestamp(),
    description: params.description,
    manualPercent: params.manualPercent,
    percent: params.realPercent,
    mode: params.mode,
    declarationAccepted: params.declarationAccepted,
    serviceId,
  };

  if (params.token) payload.token = params.token;
  if (params.previousPercent !== undefined) {
    payload.previousPercent = Number.isFinite(params.previousPercent ?? NaN)
      ? Number(params.previousPercent)
      : null;
  }

  if (params.timeWindow) {
    const timeWindowPayload: Record<string, unknown> = {};
    if (typeof params.timeWindow.start === "number" && Number.isFinite(params.timeWindow.start)) {
      timeWindowPayload.start = Timestamp.fromMillis(params.timeWindow.start);
    }
    if (typeof params.timeWindow.end === "number" && Number.isFinite(params.timeWindow.end)) {
      timeWindowPayload.end = Timestamp.fromMillis(params.timeWindow.end);
    }
    if (typeof params.timeWindow.hours === "number" && Number.isFinite(params.timeWindow.hours)) {
      timeWindowPayload.hours = Number(params.timeWindow.hours);
    }
    if (Object.keys(timeWindowPayload).length > 0) {
      payload.timeWindow = timeWindowPayload;
    }
  }

  if (params.subactivity) {
    const { id, label } = params.subactivity;
    if ((id && id.trim()) || (label && label.trim())) {
      payload.subactivity = {
        id: id?.trim() || undefined,
        label: label?.trim() || undefined,
      };
    }
  }

  if (params.impediments?.length) {
    payload.impediments = params.impediments
      .slice(0, 5)
      .map((item) => ({
        type: item.type.trim(),
        durationHours:
          typeof item.durationHours === "number" && Number.isFinite(item.durationHours)
            ? Number(item.durationHours)
            : null,
      }));
  }

  if (params.resources?.length) {
    payload.resources = params.resources
      .slice(0, 8)
      .map((item) => ({
        name: item.name.trim(),
        quantity:
          typeof item.quantity === "number" && Number.isFinite(item.quantity) && item.quantity > 0
            ? Number(item.quantity)
            : null,
        unit: item.unit?.trim() || null,
      }));
  }

  if (params.workforce?.length) {
    payload.workforce = params.workforce
      .map((item) => ({
        role: item.role.trim(),
        quantity: Math.max(1, Math.round(Number(item.quantity))),
      }))
      .filter((item) => item.role && Number.isFinite(item.quantity))
      .slice(0, 12);
  }

  if (params.shiftConditions?.length) {
    payload.shiftConditions = params.shiftConditions
      .map((item) => {
        const shift = item.shift.trim().toLowerCase();
        const weather = item.weather.trim().toLowerCase();
        const condition = item.condition.trim().toLowerCase();
        if (!SHIFT_VALUES.has(shift) || !WEATHER_VALUES.has(weather) || !CONDITION_VALUES.has(condition)) {
          return null;
        }
        return { shift, weather, condition };
      })
      .filter(Boolean)
      .slice(0, 2);
  }

  if (params.forecastDate && Number.isFinite(params.forecastDate)) {
    payload.forecastDate = Timestamp.fromMillis(params.forecastDate);
  }

  if (typeof params.criticality === "number" && Number.isFinite(params.criticality)) {
    payload.criticality = Math.round(Math.max(1, Math.min(5, params.criticality)));
  }

  if (params.evidences?.length) {
    payload.evidences = params.evidences
      .slice(0, 5)
      .map((item) => ({
        url: item.url.trim(),
        label: item.label?.trim() || null,
      }));
  }

  if (typeof params.justification === "string" && params.justification.trim()) {
    payload.justification = params.justification.trim();
  }

  const audit: Record<string, unknown> = {
    submittedAt: FieldValue.serverTimestamp(),
    newPercent: params.realPercent,
  };
  if (params.token) {
    audit.submittedByType = "token";
    audit.submittedBy = params.token;
    audit.token = params.token;
  } else {
    audit.submittedByType = "system";
  }
  if (params.previousPercent !== undefined) {
    audit.previousPercent = Number.isFinite(params.previousPercent ?? NaN)
      ? Number(params.previousPercent)
      : null;
  }
  if (params.ip) {
    audit.ip = params.ip;
  }
  payload.audit = audit;

  return payload;
}

export async function addManualUpdate(
  serviceId: string,
  input: ManualUpdateInput,
): Promise<{ realPercent: number; update: ServiceUpdate }> {
  const percent = sanitisePercent(input.manualPercent);
  const description = input.description.trim();
  const mode = input.mode === "detailed" ? "detailed" : "simple";

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
      buildUpdatePayload(serviceId, {
        ...input,
        manualPercent: percent,
        realPercent: percent,
        description,
        mode,
      }),
    );

    tx.update(serviceRef, {
      realPercent: percent,
      manualPercent: percent,
      andamento: percent,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return updateRef.id;
  });

  const updateSnap = await servicesCollection()
    .doc(serviceId)
    .collection("updates")
    .doc(updateId)
    .get();

  const mapped = mapUpdateDoc(serviceId, updateSnap);
  return { realPercent: mapped.realPercentSnapshot ?? percent, update: mapped };
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
      buildComputedUpdatePayload({
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

async function deleteSubcollection(
  ref: FirebaseFirestore.DocumentReference,
  name: string,
): Promise<void> {
  const snap = await ref.collection(name).get();
  if (snap.empty) return;
  await Promise.all(snap.docs.map((doc) => doc.ref.delete()));
}

export async function deleteService(serviceId: string): Promise<boolean> {
  const ref = servicesCollection().doc(serviceId);
  const snap = await ref.get();
  if (!snap.exists) {
    return false;
  }

  await deleteSubcollection(ref, "checklist").catch((error) => {
    console.error(`[services] Falha ao excluir checklist do serviço ${serviceId}`, error);
    throw error;
  });
  await deleteSubcollection(ref, "updates").catch((error) => {
    console.error(`[services] Falha ao excluir updates do serviço ${serviceId}`, error);
    throw error;
  });
  await deleteSubcollection(ref, "serviceUpdates").catch((error) => {
    console.error(`[services] Falha ao excluir serviceUpdates do serviço ${serviceId}`, error);
    throw error;
  });

  await ref.delete();
  return true;
}
