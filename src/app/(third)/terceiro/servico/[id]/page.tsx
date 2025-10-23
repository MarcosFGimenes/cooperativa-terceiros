export const dynamic = "force-dynamic";
export const revalidate = 0;

import ServiceDetailsClient from "./ServiceDetailsClient";
import type { ThirdChecklistItem, ThirdService, ThirdServiceUpdate } from "./types";
import { tryGetAdminDb, getServerWebDb } from "@/lib/serverDb";
import { getTokenCookie } from "@/lib/tokenSession";
import { getServicesForToken } from "@/lib/terceiroService";

type FirestoreDateLike = {
  toMillis?: () => number;
  toDate?: () => Date;
  seconds?: number;
  nanoseconds?: number;
} | null;

function toMillis(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.getTime();
    return null;
  }
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? null : time;
  }
  if (typeof value === "object" && value) {
    const maybe = value as FirestoreDateLike;
    if (maybe?.toMillis) {
      const millis = maybe.toMillis();
      if (typeof millis === "number" && Number.isFinite(millis)) return millis;
    }
    if (maybe?.toDate) {
      const date = maybe.toDate();
      if (date && !Number.isNaN(date.getTime())) return date.getTime();
    }
    if (typeof maybe?.seconds === "number") {
      const millis = maybe.seconds * 1000 + Math.round((maybe.nanoseconds ?? 0) / 1_000_000);
      if (Number.isFinite(millis)) return millis;
    }
  }
  return null;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toOptionalString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function clampPercent(value: number | null): number {
  if (!Number.isFinite(value ?? NaN)) return 0;
  return Math.min(100, Math.max(0, Number(value)));
}

function pickDateFieldMillis(data: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    if (!(key in data)) continue;
    const millis = toMillis(data[key]);
    if (millis !== null) return millis;
  }
  return null;
}

function normaliseChecklistStatus(value: unknown): ThirdChecklistItem["status"] {
  const raw = String(value ?? "").trim().toLowerCase().replace(/_/g, "-");
  if (raw.includes("conclu")) return "concluido";
  if (raw.includes("andamento")) return "em-andamento";
  return "nao-iniciado";
}

function mapServiceDocument(id: string, data: Record<string, unknown>): ThirdService {
  const plannedStart = pickDateFieldMillis(data, [
    "plannedStart",
    "inicioPrevisto",
    "inicioPlanejado",
    "dataInicio",
    "startDate",
  ]);
  const plannedEnd = pickDateFieldMillis(data, [
    "plannedEnd",
    "fimPrevisto",
    "fimPlanejado",
    "dataFim",
    "endDate",
  ]);
  const totalHours =
    toFiniteNumber(
      data.totalHours ??
        data.totalHoras ??
        data.horasTotais ??
        data.horasPrevistas ??
        data.hours ??
        data.horas,
    ) ?? null;
  const realPercent =
    toFiniteNumber(data.realPercent ?? data.real_percent ?? data.andamento ?? data.progress) ?? null;
  const manualPercent = toFiniteNumber(data.manualPercent ?? data.manual_percent) ?? null;
  const andamento = toFiniteNumber(data.andamento ?? data.progress) ?? null;

  const companyCandidates = [
    data.company,
    data.companyId,
    data.company_id,
    data.empresa,
    data.empresaId,
    data.empresa_id,
  ];
  const company = companyCandidates.map(toOptionalString).find((value) => value) ?? null;

  const os = toOptionalString(data.os ?? (data as Record<string, unknown>).OS ?? data.serviceNumber);
  const oc = toOptionalString(data.oc ?? data.ordemCompra);
  const code = toOptionalString(data.code ?? data.codigo ?? data.serviceCode);
  const tag = toOptionalString(data.tag);
  const equipmentName = toOptionalString(data.equipmentName ?? data.equipamento ?? data.equipment);
  const sector = toOptionalString(data.sector ?? data.setor ?? data.sectorName);
  const status = toOptionalString(data.status);

  return {
    id,
    os,
    oc,
    code,
    tag,
    equipmentName,
    sector,
    status,
    plannedStart,
    plannedEnd,
    totalHours,
    company,
    andamento,
    realPercent,
    manualPercent,
    updatedAt: toMillis(data.updatedAt ?? data.lastUpdate ?? data.modifiedAt),
    hasChecklist: data.hasChecklist === true || Array.isArray(data.checklist),
  };
}

function mapUpdateDocument(id: string, data: Record<string, unknown>): ThirdServiceUpdate {
  const percentCandidate =
    toFiniteNumber(data.manualPercent ?? data.manual_percent) ??
    toFiniteNumber(
      data.realPercentSnapshot ?? data.real_percent_snapshot ?? data.realPercent ?? data.percent ?? data.progress,
    ) ??
    0;

  const description = toOptionalString(data.note ?? data.description ?? data.text) ?? undefined;

  return {
    id,
    percent: clampPercent(percentCandidate),
    description,
    createdAt: toMillis(data.createdAt),
  };
}

function mapChecklistDocument(id: string, data: Record<string, unknown>): ThirdChecklistItem {
  return {
    id,
    description: toOptionalString(data.description) ?? "Item do checklist",
    weight: toFiniteNumber(data.weight) ?? 0,
    progress: clampPercent(toFiniteNumber(data.progress) ?? 0),
    status: normaliseChecklistStatus(data.status),
    updatedAt: toMillis(data.updatedAt),
  };
}

async function fetchService(serviceId: string): Promise<ThirdService | null> {
  const adminDb = tryGetAdminDb();
  if (adminDb) {
    const snap = await adminDb.collection("services").doc(serviceId).get();
    if (!snap.exists) return null;
    return mapServiceDocument(snap.id, (snap.data() ?? {}) as Record<string, unknown>);
  }

  const webDb = await getServerWebDb();
  const { doc, getDoc } = await import("firebase/firestore");
  const ref = doc(webDb, "services", serviceId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return mapServiceDocument(snap.id, snap.data() as Record<string, unknown>);
}

async function fetchServiceUpdates(serviceId: string, limitCount: number): Promise<ThirdServiceUpdate[]> {
  const adminDb = tryGetAdminDb();
  if (adminDb) {
    const col = adminDb.collection("services").doc(serviceId).collection("updates");
    const snap = await col.orderBy("createdAt", "desc").limit(limitCount).get();
    return snap.docs.map((doc) => mapUpdateDocument(doc.id, (doc.data() ?? {}) as Record<string, unknown>));
  }

  const webDb = await getServerWebDb();
  const { collection, getDocs, limit, orderBy, query } = await import("firebase/firestore");
  const q = query(
    collection(webDb, "services", serviceId, "updates"),
    orderBy("createdAt", "desc"),
    limit(limitCount),
  );
  const snap = await getDocs(q);
  return snap.docs.map((doc) => mapUpdateDocument(doc.id, doc.data() as Record<string, unknown>));
}

async function fetchServiceChecklist(serviceId: string): Promise<ThirdChecklistItem[]> {
  const adminDb = tryGetAdminDb();
  if (adminDb) {
    const col = adminDb.collection("services").doc(serviceId).collection("checklist");
    const snap = await col.orderBy("description", "asc").get();
    return snap.docs.map((doc) => mapChecklistDocument(doc.id, (doc.data() ?? {}) as Record<string, unknown>));
  }

  const webDb = await getServerWebDb();
  const { collection, getDocs, orderBy, query } = await import("firebase/firestore");
  const q = query(collection(webDb, "services", serviceId, "checklist"), orderBy("description", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((doc) => mapChecklistDocument(doc.id, doc.data() as Record<string, unknown>));
}

export default async function TerceiroServicoPage({ params }: { params: { id: string } }) {
  const token = getTokenCookie();
  if (!token) return null;

  const allowed = (await getServicesForToken(token)).some((service) => service.id === params.id);
  if (!allowed) {
    return <div className="card p-6">Acesso negado a este serviço.</div>;
  }

  const service = await fetchService(params.id);
  if (!service) {
    return <div className="card p-6">Serviço não encontrado.</div>;
  }

  const [updates, checklist] = await Promise.all([
    fetchServiceUpdates(params.id, 20).catch((error) => {
      console.error(`[terceiro/${params.id}] Falha ao carregar atualizações`, error);
      return [] as ThirdServiceUpdate[];
    }),
    fetchServiceChecklist(params.id).catch((error) => {
      console.error(`[terceiro/${params.id}] Falha ao carregar checklist`, error);
      return [] as ThirdChecklistItem[];
    }),
  ]);

  const hasChecklist = service.hasChecklist || checklist.length > 0;

  return (
    <ServiceDetailsClient service={{ ...service, hasChecklist }} updates={updates} checklist={checklist} />
  );
}
