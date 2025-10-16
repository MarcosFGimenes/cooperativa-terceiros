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
