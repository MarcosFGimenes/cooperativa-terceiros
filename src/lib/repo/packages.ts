"use server";

import { getAdmin } from "@/lib/firebaseAdmin";
import type { Package, Service } from "@/lib/types";
import { FieldValue } from "firebase-admin/firestore";
import { revalidateTag, unstable_cache } from "next/cache";

const getDb = () => getAdmin().db;
const packagesCollection = () => getDb().collection("packages");
const servicesCollection = () => getDb().collection("services");
const foldersCollection = () => getDb().collection("packageFolders");
const accessTokensCollection = () => getDb().collection("accessTokens");

const PACKAGE_CACHE_TTL_SECONDS = 300;

const PACKAGE_DETAIL_BASE_FIELDS = [
  "name",
  "nome",
  "status",
  "plannedStart",
  "dataInicio",
  "inicioPlanejado",
  "startDate",
  "plannedEnd",
  "dataFim",
  "fimPlanejado",
  "endDate",
  "totalHours",
  "horasTotais",
  "totalHoras",
  "code",
  "codigo",
  "description",
  "descricao",
  "details",
  "createdAt",
  "created_at",
  "criadoEm",
  "createdAtMs",
  "assignedCompanies",
  "serviceIds",
];

const packageSummaryCache = unstable_cache(
  async (packageId: string) => {
    const snap = await packagesCollection()
      .doc(packageId)
      .select("name", "nome", "status", "serviceIds", "createdAt")
      .get();
    if (!snap.exists) return null;
    return mapPackageDoc(snap);
  },
  ["packages", "summary"],
  {
    revalidate: PACKAGE_CACHE_TTL_SECONDS,
    tags: ["packages:summary"],
  },
);

const packageDetailCache = unstable_cache(
  async (packageId: string) => {
    const docRef = packagesCollection().doc(packageId);
    const snap = await docRef.select(...PACKAGE_DETAIL_BASE_FIELDS).get();
    if (!snap.exists) return null;

    const baseData = (snap.data() ?? {}) as Record<string, unknown>;

    if (!Array.isArray(baseData.serviceIds) || baseData.serviceIds.length === 0) {
      try {
        const servicesSnap = await docRef.select("services").get();
        if (servicesSnap.exists) {
          const servicesData = servicesSnap.data() ?? {};
          if (Array.isArray((servicesData as Record<string, unknown>).services)) {
            baseData.services = (servicesData as Record<string, unknown>).services;
          }
        }
      } catch (error) {
        console.warn(`[packages:getPackageById] Failed to fetch legacy services for package ${packageId}`, error);
      }
    }

    return mapPackageData(snap.id, baseData);
  },
  ["packages", "detail"],
  {
    revalidate: PACKAGE_CACHE_TTL_SECONDS,
    tags: ["packages:detail"],
  },
);

function revalidatePackageDetailCache(packageId: string) {
  if (!packageId) return;
  revalidateTag("packages:detail");
  revalidateTag("packages:summary");
}

function toMillis(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  const maybeTimestamp = value as { toMillis?: () => number } | undefined;
  if (maybeTimestamp?.toMillis) return maybeTimestamp.toMillis();
  return undefined;
}

function mapPackageDoc(
  doc: FirebaseFirestore.DocumentSnapshot,
): Package {
  const data = doc.data() ?? {};
  return {
    id: doc.id,
    name: data.name ?? "",
    status: data.status ?? "aberto",
    serviceIds: data.serviceIds ?? [],
    createdAt: toMillis(data.createdAt),
  };
}

export async function getPackage(packageId: string): Promise<Package | null> {
  const trimmedId = typeof packageId === "string" ? packageId.trim() : "";
  if (!trimmedId) return null;

  return packageSummaryCache(trimmedId);
}

function normaliseDateOnlyInput(value: string | null | undefined, label: string): string {
  if (value === undefined) {
    throw new Error(`Informe a data ${label} do pacote.`);
  }
  if (value === null) {
    return "";
  }
  const trimmed = String(value).trim();
  if (!trimmed) {
    return "";
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Data ${label} inválida.`);
  }
  return date.toISOString().slice(0, 10);
}

async function commitBatchOperations(
  operations: Array<(batch: FirebaseFirestore.WriteBatch) => void>,
  chunkSize = 400,
): Promise<void> {
  if (!operations.length) {
    return;
  }
  const db = getDb();
  for (let index = 0; index < operations.length; index += chunkSize) {
    const batch = db.batch();
    operations.slice(index, index + chunkSize).forEach((operation) => {
      operation(batch);
    });
    await batch.commit();
  }
}

function normalisePackageStatus(value: unknown): Package["status"] {
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

function extractServiceId(value: unknown): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 0) return trimmed;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const candidates: unknown[] = [
      record.id,
      record.serviceId,
      record.serviceID,
      record.service,
      record.code,
      record.codigo,
      record.os,
      record.OS,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim().length > 0) {
        return candidate.trim();
      }
      if (typeof candidate === "number" && Number.isFinite(candidate)) {
        return String(candidate);
      }
    }
  }
  return "";
}

function normaliseServiceIds(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const entries = value
    .map((item) => extractServiceId(item))
    .filter((id) => id.length > 0);
  return entries.length ? entries : undefined;
}

function mapPackageData(id: string, data: Record<string, unknown>): Package {
  const plannedStart = String(
    data.plannedStart ?? data.dataInicio ?? data.inicioPlanejado ?? data.startDate ?? "",
  );
  const plannedEnd = String(
    data.plannedEnd ?? data.dataFim ?? data.fimPlanejado ?? data.endDate ?? "",
  );
  const totalHours = toNumber(data.totalHours ?? data.horasTotais ?? data.totalHoras) ?? 0;
  const createdAt =
    toNumber(data.createdAt ?? data.created_at ?? data.criadoEm ?? data.createdAtMs) ?? Date.now();

  const descriptionRaw =
    typeof data.description === "string"
      ? data.description
      : typeof data.descricao === "string"
        ? data.descricao
        : typeof data.details === "string"
          ? data.details
          : undefined;
  const description = typeof descriptionRaw === "string" ? descriptionRaw.trim() : "";

  const assignedCompanies = Array.isArray(data.assignedCompanies)
    ? (data.assignedCompanies as Record<string, unknown>[]).map((entry) => ({
        companyId: String(entry.companyId ?? entry.id ?? ""),
        companyName: entry.companyName ? String(entry.companyName) : undefined,
      }))
    : undefined;

  const normalisedServiceIds = normaliseServiceIds(data.serviceIds);
  const normalisedLegacyServices = normaliseServiceIds(data.services);
  const serviceIds = normalisedServiceIds ?? normalisedLegacyServices;
  const services = serviceIds ?? normalisedLegacyServices;

  return {
    id,
    name: String(data.name ?? data.nome ?? `Pacote ${id}`),
    status: normalisePackageStatus(data.status),
    plannedStart,
    plannedEnd,
    totalHours,
    code: data.code ? String(data.code) : data.codigo ? String(data.codigo) : undefined,
    description: description ? description : null,
    services,
    createdAt,
    assignedCompanies,
    serviceIds,
  };
}

export type PackageSummary = Pick<Package, "id" | "name" | "status" | "code" | "createdAt"> & {
  servicesCount: number;
};

function toPackageSummary(id: string, data: Record<string, unknown>): PackageSummary {
  const services = Array.isArray(data.services)
    ? (data.services as unknown[])
    : Array.isArray(data.serviceIds)
      ? (data.serviceIds as unknown[])
      : [];
  const servicesCount = services.length;
  const createdAt =
    toNumber(data.createdAt ?? data.created_at ?? data.criadoEm ?? data.createdAtMs) ?? Date.now();

  return {
    id,
    name: String(data.name ?? data.nome ?? `Pacote ${id}`),
    status: normalisePackageStatus(data.status),
    code: data.code ? String(data.code) : data.codigo ? String(data.codigo) : undefined,
    createdAt,
    servicesCount,
  };
}

export async function getPackageById(id: string): Promise<Package | null> {
  const trimmedId = typeof id === "string" ? id.trim() : "";
  if (!trimmedId) return null;

  return packageDetailCache(trimmedId);
}

const listRecentPackagesCached = unstable_cache(
  async () => {
    const snap = await packagesCollection().orderBy("createdAt", "desc").limit(20).get();
    return snap.docs.map((doc) => toPackageSummary(doc.id, (doc.data() ?? {}) as Record<string, unknown>));
  },
  ["packages:listRecent"],
  {
    revalidate: 300,
    tags: ["packages:recent"],
  },
);

export async function listRecentPackages(): Promise<PackageSummary[]> {
  return listRecentPackagesCached();
}

export async function listPackageServices(
  packageId: string,
  options?: { limit?: number },
): Promise<Service[]> {
  if (!packageId) return [];
  const baseQuery = servicesCollection().where("packageId", "==", packageId);
  const { limit } = options ?? {};
  const query = (() => {
    if (typeof limit !== "number" || !Number.isFinite(limit) || limit <= 0) {
      return baseQuery;
    }
    const safeLimit = Math.max(1, Math.min(Math.floor(limit), 2000));
    return baseQuery.limit(safeLimit);
  })();

  const servicesSnap = await query.get();
  return servicesSnap.docs.map((doc) => {
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
      status: data.status ?? "aberto",
      company: data.company ?? undefined,
      createdAt: toMillis(data.createdAt),
      updatedAt: toMillis(data.updatedAt),
      hasChecklist: data.hasChecklist ?? false,
      realPercent: data.realPercent ?? 0,
      packageId: data.packageId ?? undefined,
    };
  });
}

export async function createPackage(
  name: string,
  serviceIds: string[],
): Promise<string> {
  const uniqueServiceIds = Array.from(new Set(serviceIds));

  const { db } = getAdmin();
  const packageId = await db.runTransaction(async (tx) => {
    const packageRef = packagesCollection().doc();
    tx.set(packageRef, {
      name,
      status: "aberto",
      serviceIds: uniqueServiceIds,
      createdAt: FieldValue.serverTimestamp(),
    });

    uniqueServiceIds.forEach((serviceId) => {
      const serviceRef = servicesCollection().doc(serviceId);
      tx.update(serviceRef, {
        packageId: packageRef.id,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    return packageRef.id;
  });

  revalidateTag("packages:recent");
  revalidateTag("services:recent");
  revalidatePackageDetailCache(packageId);

  return packageId;
}

export async function updatePackageMetadata(
  packageId: string,
  data: {
    name?: string;
    description?: string | null;
    plannedStart?: string;
    plannedEnd?: string;
    status?: Package["status"];
    code?: string | null;
  },
): Promise<Package> {
  const trimmedId = typeof packageId === "string" ? packageId.trim() : "";
  if (!trimmedId) {
    throw new Error("Pacote inválido.");
  }

  const ref = packagesCollection().doc(trimmedId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error("Pacote não encontrado.");
  }

  const existing = mapPackageData(trimmedId, (snap.data() ?? {}) as Record<string, unknown>);
  const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };

  if (data.name !== undefined) {
    const trimmedName = typeof data.name === "string" ? data.name.trim() : "";
    if (!trimmedName) {
      throw new Error("Informe o nome do pacote.");
    }
    updates.name = trimmedName;
    updates.nome = trimmedName;
  }

  let nextStart = existing.plannedStart?.trim() ?? "";
  if (data.plannedStart !== undefined) {
    if (typeof data.plannedStart !== "string") {
      throw new Error("Data inicial inválida.");
    }
    const normalised = normaliseDateOnlyInput(data.plannedStart, "inicial");
    if (!normalised) {
      throw new Error("Informe a data inicial do pacote.");
    }
    nextStart = normalised;
    updates.plannedStart = normalised;
    updates.dataInicio = normalised;
    updates.inicioPlanejado = normalised;
    updates.startDate = normalised;
  }

  let nextEnd = existing.plannedEnd?.trim() ?? "";
  if (data.plannedEnd !== undefined) {
    if (typeof data.plannedEnd !== "string") {
      throw new Error("Data final inválida.");
    }
    const normalised = normaliseDateOnlyInput(data.plannedEnd, "final");
    if (!normalised) {
      throw new Error("Informe a data final do pacote.");
    }
    nextEnd = normalised;
    updates.plannedEnd = normalised;
    updates.dataFim = normalised;
    updates.fimPlanejado = normalised;
    updates.endDate = normalised;
  }

  if (nextStart && nextEnd) {
    const startDate = new Date(nextStart);
    const endDate = new Date(nextEnd);
    if (
      !Number.isNaN(startDate.getTime()) &&
      !Number.isNaN(endDate.getTime()) &&
      startDate.getTime() > endDate.getTime()
    ) {
      throw new Error("A data final deve ser posterior ou igual à data inicial.");
    }
  }

  if (data.description !== undefined) {
    const trimmedDescription =
      typeof data.description === "string" ? data.description.trim() : "";
    const value = trimmedDescription ? trimmedDescription : null;
    updates.description = value;
    updates.descricao = value;
    updates.details = value;
  }

  if (data.status !== undefined) {
    updates.status = normalisePackageStatus(data.status);
  }

  if (data.code !== undefined) {
    const trimmedCode = typeof data.code === "string" ? data.code.trim() : "";
    const value = trimmedCode ? trimmedCode : null;
    updates.code = value;
    updates.codigo = value;
  }

  if (Object.keys(updates).length === 1) {
    return existing;
  }

  await ref.set(updates, { merge: true });
  const updatedSnap = await ref.get();
  if (!updatedSnap.exists) {
    throw new Error("Pacote não encontrado após atualização.");
  }
  const updated = mapPackageData(updatedSnap.id, (updatedSnap.data() ?? {}) as Record<string, unknown>);

  revalidateTag("packages:recent");
  revalidatePackageDetailCache(trimmedId);

  return updated;
}

export async function deletePackage(packageId: string): Promise<boolean> {
  const trimmedId = typeof packageId === "string" ? packageId.trim() : "";
  if (!trimmedId) {
    throw new Error("Pacote inválido.");
  }

  const ref = packagesCollection().doc(trimmedId);
  const snap = await ref.get();
  if (!snap.exists) {
    return false;
  }

  const operations: Array<(batch: FirebaseFirestore.WriteBatch) => void> = [
    (batch) => batch.delete(ref),
  ];

  const servicesSnap = await servicesCollection().where("packageId", "==", trimmedId).get();
  servicesSnap.docs.forEach((doc) => {
    operations.push((batch) => {
      batch.set(
        doc.ref,
        {
          packageId: FieldValue.delete(),
          pacoteId: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    });
  });

  const foldersSnap = await foldersCollection().where("packageId", "==", trimmedId).get();
  const tokenUpdates: Promise<unknown>[] = [];
  foldersSnap.docs.forEach((doc) => {
    const data = doc.data() ?? {};
    const rawTokenId = typeof data.tokenId === "string" ? data.tokenId.trim() : "";
    const rawTokenCode = typeof data.tokenCode === "string" ? data.tokenCode.trim() : "";
    const tokenId = rawTokenId || rawTokenCode;
    if (tokenId) {
      tokenUpdates.push(
        accessTokensCollection()
          .doc(tokenId)
          .set(
            {
              active: false,
              status: "revoked",
              revoked: true,
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          )
          .catch((error) => {
            console.error(
              `[packages] Falha ao revogar token ${tokenId} da pasta ${doc.id}`,
              error,
            );
          }),
      );
    }
    operations.push((batch) => {
      batch.delete(doc.ref);
    });
  });

  if (tokenUpdates.length) {
    await Promise.all(tokenUpdates);
  }

  await commitBatchOperations(operations);

  revalidateTag("packages:recent");
  revalidateTag("services:recent");
  revalidatePackageDetailCache(trimmedId);

  return true;
}
