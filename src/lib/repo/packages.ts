import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import type { PackageDoc } from "@/lib/types";

export async function getPackage(packageId: string): Promise<PackageDoc | null> {
  const snap = await getDoc(doc(db, "packages", packageId));
  if (!snap.exists()) return null;
  const d = snap.data() as any;
  return {
    id: snap.id,
    name: d.name,
    description: d.description,
    status: d.status ?? "aberto",
    serviceIds: d.serviceIds ?? [],
    companyIds: d.companyIds ?? [],
    createdAt: d.createdAt?.toDate?.(),
    updatedAt: d.updatedAt?.toDate?.(),
  };
}
