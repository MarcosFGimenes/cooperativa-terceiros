import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import { revalidatePath, revalidateTag } from "next/cache";

import { getAdminDbOrThrow } from "@/lib/serverDb";
import { parseDayFirstDateStringToUtcDate } from "@/lib/dateParsing";
import {
  buildChecklistWeightMap,
  clampPercent,
  computeProgressFromEvents,
  type ChecklistWeightInput,
  type ProgressEvent,
} from "./progressHistory";

function toMillis(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    // Suporte a "dd/MM/yyyy" e "dd/MM/yy" (com "/" ou "-"), comum no input do usuário.
    const brDate = parseDayFirstDateStringToUtcDate(trimmed);
    if (brDate) return brDate.getTime();

    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
  }
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? null : time;
  }
  if (value && typeof (value as { toMillis?: () => number }).toMillis === "function") {
    const millis = (value as { toMillis: () => number }).toMillis();
    return typeof millis === "number" && Number.isFinite(millis) ? millis : null;
  }
  if (value && typeof (value as { toDate?: () => Date }).toDate === "function") {
    const date = (value as { toDate: () => Date }).toDate();
    if (date && !Number.isNaN(date.getTime())) return date.getTime();
  }
  if (value && typeof (value as { seconds?: number; nanoseconds?: number }).seconds === "number") {
    const maybe = value as { seconds: number; nanoseconds?: number };
    const millis = maybe.seconds * 1000 + Math.round((maybe.nanoseconds ?? 0) / 1_000_000);
    return Number.isFinite(millis) ? millis : null;
  }
  return null;
}

function normalisePercentFromUpdate(data: Record<string, unknown>): number | null {
  // Priorizar manualPercent e realPercentSnapshot que são os campos usados para o valor digitado pelo terceiro
  const candidates = [
    data.manualPercent, // Valor digitado diretamente pelo terceiro
    data.realPercentSnapshot, // Snapshot do valor real
    data.realPercent, // Valor real sem snapshot
    data.percent, // Campo genérico de percentual
    data.totalPct, // Percentual total (legado)
    data.progress, // Campo de progresso
  ];
  for (const candidate of candidates) {
    const parsed = typeof candidate === "number" ? candidate : Number(candidate ?? NaN);
    if (Number.isFinite(parsed)) {
      // Preservar valor exato, apenas garantir que está no range válido
      return clampPercent(parsed);
    }
  }
  return null;
}

function normaliseItems(raw: unknown): Array<{ id: string; pct: number }> {
  if (!Array.isArray(raw)) return [];
  return (raw as Array<Record<string, unknown>>)
    .map((item) => {
      const idSource = item.id ?? item.itemId;
      const pctSource = item.pct;
      const id = typeof idSource === "string" ? idSource.trim() : "";
      const pct = typeof pctSource === "number" ? pctSource : Number(pctSource ?? NaN);
      if (!id || !Number.isFinite(pct)) return null;
      return { id, pct: clampPercent(pct) };
    })
    .filter(Boolean) as Array<{ id: string; pct: number }>;
}

function normaliseEvent(
  data: Record<string, unknown>,
  fallbackTimestamp: number | null,
  includeItems: boolean,
): ProgressEvent | null {
  const timestamp =
    toMillis(data.reportDate) ??
    toMillis(data.date) ??
    toMillis((data.timeWindow as Record<string, unknown> | undefined)?.start) ??
    toMillis(data.createdAt) ??
    fallbackTimestamp;

  if (!Number.isFinite(timestamp ?? NaN)) return null;

  const percent = normalisePercentFromUpdate(data);
  const items = includeItems ? normaliseItems(data.items) : [];
  return { timestamp: Number(timestamp), percent, items: items.length ? items : undefined };
}

export async function loadProgressHistory(
  adminDb: Firestore,
  serviceId: string,
): Promise<{
  events: ProgressEvent[];
  lastManualUpdate: { percent: number; timestamp: number } | null;
  weights: Map<string, number>;
  totalWeight: number;
  serviceData: Record<string, unknown>;
}> {
  const serviceRef = adminDb.collection("services").doc(serviceId);
  const [serviceSnap, updatesSnap, legacySnap] = await Promise.all([
    serviceRef.get(),
    serviceRef.collection("updates").orderBy("createdAt", "asc").get(),
    serviceRef.collection("serviceUpdates").orderBy("date", "asc").get(),
  ]);

  const checklistRaw = (serviceSnap.data() ?? {}) as Record<string, unknown>;
  const checklist = Array.isArray(checklistRaw.checklist)
    ? (checklistRaw.checklist as ChecklistWeightInput)
    : [];
  const { weights, totalWeight } = buildChecklistWeightMap(checklist);

  const events: ProgressEvent[] = [];
  let lastManualUpdate: { percent: number; timestamp: number } | null = null;
  updatesSnap.docs.forEach((doc) => {
    const data = (doc.data() ?? {}) as Record<string, unknown>;
    const event = normaliseEvent(data, toMillis(doc.createTime) ?? null, false);
    if (event) events.push(event);

    const manualCandidate = typeof data.manualPercent === "number" ? data.manualPercent : Number(data.manualPercent ?? NaN);
    if (event && typeof manualCandidate === "number" && Number.isFinite(manualCandidate)) {
      lastManualUpdate = { percent: clampPercent(manualCandidate), timestamp: event.timestamp };
    }
  });

  legacySnap.docs.forEach((doc) => {
    const data = (doc.data() ?? {}) as Record<string, unknown>;
    const event = normaliseEvent(data, toMillis(doc.createTime) ?? null, true);
    if (event) events.push(event);
  });

  return {
    events,
    lastManualUpdate,
    weights,
    totalWeight,
    serviceData: (serviceSnap.data() ?? {}) as Record<string, unknown>,
  };
}

export async function recomputeServiceProgress(serviceId: string) {
  const adminDb = getAdminDbOrThrow();
  const { events, lastManualUpdate, weights, totalWeight, serviceData } = await loadProgressHistory(adminDb, serviceId);

  const computed = computeProgressFromEvents(events, { weights, totalWeight });
  const lastTimestamp = computed.lastTimestamp;

  // Priorizar o lançamento manual mais recente quando ele for o último evento manual registrado.
  // Isso evita que o checklist "rebaixe" um valor digitado pelo terceiro.
  const manualPercentValue =
    lastManualUpdate && typeof lastManualUpdate.percent === "number" && Number.isFinite(lastManualUpdate.percent)
      ? clampPercent(lastManualUpdate.percent)
      : null;
  const manualTimestamp =
    lastManualUpdate && typeof lastManualUpdate.timestamp === "number" && Number.isFinite(lastManualUpdate.timestamp)
      ? lastManualUpdate.timestamp
      : null;

  const shouldUseManual = manualPercentValue !== null && (lastTimestamp === null || (manualTimestamp ?? -1) >= lastTimestamp);

  const currentPercent = shouldUseManual ? manualPercentValue : computed.currentPercent;

  const payload: Record<string, unknown> = {
    andamento: currentPercent,
    realPercent: currentPercent,
    realPercentSnapshot: currentPercent,
    percent: currentPercent,
    progress: currentPercent,
    percentualRealAtual: currentPercent,
    updatedAt: lastTimestamp ? Timestamp.fromMillis(lastTimestamp) : FieldValue.serverTimestamp(),
    lastUpdateDate: lastTimestamp ? Timestamp.fromMillis(lastTimestamp) : FieldValue.serverTimestamp(),
  };

  if (shouldUseManual) {
    payload.manualPercent = currentPercent;
  } else {
    payload.manualPercent = FieldValue.delete();
  }

  await adminDb.collection("services").doc(serviceId).update(payload);

  const packageId = typeof serviceData.packageId === "string" && serviceData.packageId.trim().length
    ? serviceData.packageId
    : null;
  const folderId = typeof serviceData.packageFolderId === "string" && serviceData.packageFolderId.trim().length
    ? serviceData.packageFolderId
    : typeof serviceData.folderId === "string" && serviceData.folderId.trim().length
      ? serviceData.folderId
      : null;

  // Revalidate caches and pages that consume the service percentage so every surface refreshes immediately after an edit.
  revalidateTag("services:detail");
  revalidateTag("services:updates");
  revalidateTag("services:legacy-updates");
  revalidateTag("services:available");
  revalidateTag("services:recent");
  revalidateTag("packages:detail");
  revalidateTag("packages:summary");
  revalidateTag("packages:services");
  revalidateTag("folders:detail");
  revalidateTag("folders:by-package");

  revalidatePath("/dashboard");
  revalidatePath("/servicos");
  revalidatePath(`/servicos/${serviceId}`);
  revalidatePath(`/servicos/${serviceId}/editar`);
  revalidatePath(`/servicos/${serviceId}/atualizacoes`);
  revalidatePath(`/terceiro/servico/${serviceId}`);

  if (packageId) {
    revalidatePath(`/pacotes/${packageId}`);
    revalidatePath(`/pacotes/${packageId}/servicos`);
  }

  if (folderId) {
    revalidatePath(`/pacotes/pastas/${folderId}`);
  }

  return { percent: currentPercent, lastUpdate: lastTimestamp };
}

export async function computeProgressHistory(serviceId: string) {
  const adminDb = getAdminDbOrThrow();
  const { events, weights, totalWeight } = await loadProgressHistory(adminDb, serviceId);
  return computeProgressFromEvents(events, { weights, totalWeight });
}
