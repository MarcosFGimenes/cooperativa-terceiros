import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import { revalidatePath, revalidateTag } from "next/cache";

import { getAdminDbOrThrow } from "@/lib/serverDb";
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
    const parsed = new Date(value);
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
    toMillis(data.createdAt) ??
    toMillis(data.date) ??
    toMillis((data.timeWindow as Record<string, unknown> | undefined)?.start) ??
    fallbackTimestamp;

  if (!Number.isFinite(timestamp ?? NaN)) return null;

  const percent = normalisePercentFromUpdate(data);
  const items = includeItems ? normaliseItems(data.items) : [];
  return { timestamp: Number(timestamp), percent, items: items.length ? items : undefined };
}

export async function loadProgressHistory(adminDb: Firestore, serviceId: string) {
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
  updatesSnap.docs.forEach((doc) => {
    const data = (doc.data() ?? {}) as Record<string, unknown>;
    const event = normaliseEvent(data, toMillis(doc.createTime) ?? null, false);
    if (event) events.push(event);
  });

  legacySnap.docs.forEach((doc) => {
    const data = (doc.data() ?? {}) as Record<string, unknown>;
    const event = normaliseEvent(data, toMillis(doc.createTime) ?? null, true);
    if (event) events.push(event);
  });

  return { events, weights, totalWeight, serviceData: (serviceSnap.data() ?? {}) as Record<string, unknown> };
}

export async function recomputeServiceProgress(serviceId: string) {
  const adminDb = getAdminDbOrThrow();
  const { events, weights, totalWeight, serviceData } = await loadProgressHistory(adminDb, serviceId);
  
  // Priorizar o último valor manual quando disponível para preservar o valor exato digitado pelo terceiro
  const lastManualUpdate = events.length > 0 ? events[events.length - 1] : null;
  const hasChecklist = Array.isArray(serviceData.checklist) && (serviceData.checklist as unknown[]).length > 0;
  
  let currentPercent: number;
  
  // Se o último update tem um percentual explícito (não apenas itens do checklist), usar esse valor
  // Isso preserva o valor digitado pelo terceiro no campo "Progresso atual registrado"
  if (lastManualUpdate && typeof lastManualUpdate.percent === "number" && Number.isFinite(lastManualUpdate.percent)) {
    // Quando há um percentual geral explícito no último update, usar esse valor exato
    // Isso garante que o valor digitado pelo terceiro seja preservado
    currentPercent = clampPercent(lastManualUpdate.percent);
  } else if (hasChecklist && lastManualUpdate && Array.isArray(lastManualUpdate.items) && lastManualUpdate.items.length > 0) {
    // Quando há checklist e o último update tem apenas itens (sem percentual geral), calcular baseado nos itens
    const computed = computeProgressFromEvents(events, { weights, totalWeight });
    currentPercent = computed.currentPercent;
  } else {
    // Caso padrão: calcular baseado nos eventos
    const computed = computeProgressFromEvents(events, { weights, totalWeight });
    currentPercent = computed.currentPercent;
  }
  
  const lastTimestamp = events.length > 0 && lastManualUpdate ? lastManualUpdate.timestamp : null;

  const payload: Record<string, unknown> = {
    andamento: currentPercent,
    realPercent: currentPercent,
    manualPercent: currentPercent,
    realPercentSnapshot: currentPercent,
    percent: currentPercent,
    progress: currentPercent,
    percentualRealAtual: currentPercent,
    updatedAt: lastTimestamp ? Timestamp.fromMillis(lastTimestamp) : FieldValue.serverTimestamp(),
    lastUpdateDate: lastTimestamp ? Timestamp.fromMillis(lastTimestamp) : FieldValue.serverTimestamp(),
  };

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
