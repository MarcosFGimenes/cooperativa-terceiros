import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { db } from "./firebase";

export type Service = {
  id: string;
  os: string;
  oc?: string;
  tag?: string;
  equipamento?: string;
  setor?: string;
  inicioPrevisto?: string; // ISO
  fimPrevisto?: string;    // ISO
  horasPrevistas?: number;
  status?: "Aberto"|"Concluído"|"Encerrado";
  empresa?: string;
  pacoteId?: string;
  andamento?: number; // 0-100
  criadoEm?: string; // ISO
};

export type Package = {
  id: string;
  nome: string;
  status?: "Aberto"|"Concluído"|"Encerrado";
  criadoEm?: string;
};

export async function listServices(opts?: { status?: string; limitTo?: number }) {
  const base = collection(db, "services");
  let q = query(base, orderBy("criadoEm","desc"));
  if (opts?.status) q = query(base, where("status","==",opts.status), orderBy("criadoEm","desc"));
  if (opts?.limitTo) q = query(q, limit(opts.limitTo));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Service[];
}

export async function getService(id: string) {
  const ref = doc(db, "services", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as any) } as Service;
}

export async function listPackages(opts?: { limitTo?: number }) {
  const base = collection(db, "packages");
  const q = opts?.limitTo ? query(base, orderBy("criadoEm","desc"), limit(opts.limitTo)) : query(base, orderBy("criadoEm","desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Package[];
}

export async function getPackage(id: string) {
  const ref = doc(db, "packages", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as any) } as Package;
}
