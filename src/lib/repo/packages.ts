"use server";

import { getAdmin } from "@/lib/firebaseAdmin";
import type { Package, Service } from "@/lib/types";
import { FieldValue } from "firebase-admin/firestore";

const getDb = () => getAdmin().db;
const packagesCollection = () => getDb().collection("packages");
const servicesCollection = () => getDb().collection("services");

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
  const snap = await packagesCollection().doc(packageId).get();
  if (!snap.exists) return null;
  return mapPackageDoc(snap);
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

  const assignedCompanies = Array.isArray(data.assignedCompanies)
    ? (data.assignedCompanies as Record<string, unknown>[]).map((entry) => ({
        companyId: String(entry.companyId ?? entry.id ?? ""),
        companyName: entry.companyName ? String(entry.companyName) : undefined,
      }))
    : undefined;

  const services = Array.isArray(data.services)
    ? (data.services as unknown[])
        .map((value) => String(value ?? ""))
        .filter((value) => value.length > 0)
    : undefined;

  return {
    id,
    name: String(data.name ?? data.nome ?? `Pacote ${id}`),
    status: normalisePackageStatus(data.status),
    plannedStart,
    plannedEnd,
    totalHours,
    code: data.code ? String(data.code) : data.codigo ? String(data.codigo) : undefined,
    services,
    createdAt,
    assignedCompanies,
  };
}

export async function getPackageById(id: string): Promise<Package | null> {
  const snap = await packagesCollection().doc(id).get();
  if (!snap.exists) return null;
  return mapPackageData(snap.id, (snap.data() ?? {}) as Record<string, unknown>);
}

export async function listRecentPackages(): Promise<Package[]> {
  const snap = await packagesCollection().orderBy("createdAt", "desc").limit(20).get();
  return snap.docs.map((doc) => mapPackageData(doc.id, (doc.data() ?? {}) as Record<string, unknown>));
}

export async function listPackageServices(
  packageId: string,
): Promise<Service[]> {
  const servicesSnap = await servicesCollection()
    .where("packageId", "==", packageId)
    .get();
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

  return packageId;
}
