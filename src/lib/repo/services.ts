import { db } from "@/lib/firebase";
import {
  addDoc, collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp,
  setDoc, updateDoc, where
} from "firebase/firestore";
import type { ServiceDoc, ServiceUpdate } from "@/lib/types";

const servicesCol = () => collection(db, "services");

export async function createService(data: Omit<ServiceDoc,"id"|"createdAt"|"updatedAt"|"startedAt"> & { startedAt?: Date }) {
  const payload: any = {
    ...data,
    packageId: data.packageId ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    startedAt: data.startedAt ? data.startedAt : serverTimestamp(),
  };
  const ref = await addDoc(servicesCol(), payload);
  return ref.id;
}

export async function getService(serviceId: string): Promise<ServiceDoc | null> {
  const snap = await getDoc(doc(db, "services", serviceId));
  if (!snap.exists()) return null;
  const d = snap.data() as any;
  return {
    id: snap.id,
    title: d.title,
    description: d.description,
    companyId: d.companyId,
    packageId: d.packageId ?? null,
    status: d.status,
    totalHoursPlanned: d.totalHoursPlanned,
    startedAt: d.startedAt?.toDate?.(),
    expectedEndAt: d.expectedEndAt?.toDate?.() ?? null,
    closedAt: d.closedAt?.toDate?.() ?? null,
    createdAt: d.createdAt?.toDate?.(),
    updatedAt: d.updatedAt?.toDate?.(),
  };
}

export async function listServicesBy(filters: { status?: "aberto"|"encerrado"; companyId?: string; packageId?: string }) {
  let q: any = servicesCol();
  const clauses: any[] = [];
  if (filters.status) clauses.push(where("status","==",filters.status));
  if (filters.companyId) clauses.push(where("companyId","==",filters.companyId));
  if (filters.packageId) clauses.push(where("packageId","==",filters.packageId));
  q = query(q, ...clauses, orderBy("createdAt","desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => {
    const x:any = d.data();
    return {
      id: d.id,
      title: x.title,
      description: x.description,
      companyId: x.companyId,
      packageId: x.packageId ?? null,
      status: x.status,
      totalHoursPlanned: x.totalHoursPlanned,
      startedAt: x.startedAt?.toDate?.(),
      expectedEndAt: x.expectedEndAt?.toDate?.() ?? null,
      closedAt: x.closedAt?.toDate?.() ?? null,
      createdAt: x.createdAt?.toDate?.(),
      updatedAt: x.updatedAt?.toDate?.(),
    } as ServiceDoc;
  });
}

// Conveniência: listar serviços por packageId
export async function listServicesByPackage(packageId: string) {
  return listServicesBy({ packageId });
}

// UPDATES
export async function addServiceUpdate(serviceId: string, payload: Omit<ServiceUpdate,"id"|"createdAt">) {
  const updatesCol = collection(db, `services/${serviceId}/updates`);
  const last = await getDocs(query(updatesCol, orderBy("createdAt","desc")));
  const lastProgress = last.docs[0]?.data()?.progress ?? 0;
  if (payload.progress < lastProgress) throw new Error(`Novo progresso (${payload.progress}%) < último (${lastProgress}%).`);
  const ref = await addDoc(updatesCol, { ...payload, createdAt: serverTimestamp() });
  return ref.id;
}

export async function listServiceUpdates(serviceId: string): Promise<ServiceUpdate[]> {
  const updatesCol = collection(db, `services/${serviceId}/updates`);
  const snap = await getDocs(query(updatesCol, orderBy("createdAt","asc")));
  return snap.docs.map(d => {
    const x: any = d.data();
    return {
      id: d.id,
      note: x.note,
      progress: x.progress ?? 0,
      createdBy: x.createdBy,
      hoursSpent: x.hoursSpent,
      createdAt: x.createdAt?.toDate?.() ?? new Date(),
    } as ServiceUpdate;
  });
}
