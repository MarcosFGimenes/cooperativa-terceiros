import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  type DocumentData,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

import { db } from "./firebase";

export type Service = {
  id: string;
  os: string;
  oc?: string;
  tag?: string;
  equipamento?: string;
  setor?: string;
  inicioPrevisto?: string; // ISO
  fimPrevisto?: string; // ISO
  horasPrevistas?: number;
  status?: "Aberto" | "Pendente" | "Concluído";
  empresa?: string;
  pacoteId?: string;
  andamento?: number; // 0-100
  criadoEm?: string; // ISO
};

export type Package = {
  id: string;
  nome: string;
  status?: "Aberto" | "Pendente" | "Concluído";
  criadoEm?: string;
};

function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function toOptionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function toStatus(value: unknown): Service["status"] | undefined {
  if (typeof value !== "string") return undefined;
  const normalised = value.trim().toLowerCase();
  if (!normalised) return undefined;
  if (normalised === "concluido" || normalised === "concluído") return "Concluído";
  if (normalised === "encerrado") return "Concluído";
  if (normalised === "pendente") return "Pendente";
  if (normalised === "aberto") return "Aberto";
  return undefined;
}

function mapServiceSnapshot(snapshot: QueryDocumentSnapshot<DocumentData>): Service {
  const data = snapshot.data() as Record<string, unknown>;
  return {
    id: snapshot.id,
    os: toOptionalString(data.os) ?? "",
    oc: toOptionalString(data.oc ?? data.O_C ?? data.OC),
    tag: toOptionalString(data.tag),
    equipamento: toOptionalString(data.equipamento ?? data.equipmentName),
    setor: toOptionalString(data.setor),
    inicioPrevisto: toOptionalString(data.inicioPrevisto),
    fimPrevisto: toOptionalString(data.fimPrevisto),
    horasPrevistas: toOptionalNumber(data.horasPrevistas),
    status: toStatus(data.status),
    empresa: toOptionalString(data.empresa ?? data.empresaId ?? data.company),
    pacoteId: toOptionalString(data.pacoteId ?? data.packageId),
    andamento: toOptionalNumber(data.andamento ?? data.progress ?? data.realPercent),
    criadoEm: toOptionalString(data.criadoEm ?? data.createdAt),
  };
}

function mapServiceDocument(snapshot: DocumentSnapshot<DocumentData>): Service | null {
  if (!snapshot.exists()) return null;
  const data = snapshot.data() as Record<string, unknown>;
  return {
    id: snapshot.id,
    os: toOptionalString(data.os) ?? "",
    oc: toOptionalString(data.oc ?? data.O_C ?? data.OC),
    tag: toOptionalString(data.tag),
    equipamento: toOptionalString(data.equipamento ?? data.equipmentName),
    setor: toOptionalString(data.setor),
    inicioPrevisto: toOptionalString(data.inicioPrevisto),
    fimPrevisto: toOptionalString(data.fimPrevisto),
    horasPrevistas: toOptionalNumber(data.horasPrevistas),
    status: toStatus(data.status),
    empresa: toOptionalString(data.empresa ?? data.empresaId ?? data.company),
    pacoteId: toOptionalString(data.pacoteId ?? data.packageId),
    andamento: toOptionalNumber(data.andamento ?? data.progress ?? data.realPercent),
    criadoEm: toOptionalString(data.criadoEm ?? data.createdAt),
  };
}

function mapPackageSnapshot(snapshot: QueryDocumentSnapshot<DocumentData>): Package {
  const data = snapshot.data() as Record<string, unknown>;
  return {
    id: snapshot.id,
    nome: toOptionalString(data.nome ?? data.name) ?? "",
    status: toStatus(data.status),
    criadoEm: toOptionalString(data.criadoEm ?? data.createdAt),
  };
}

function mapPackageDocument(snapshot: DocumentSnapshot<DocumentData>): Package | null {
  if (!snapshot.exists()) return null;
  const data = snapshot.data() as Record<string, unknown>;
  return {
    id: snapshot.id,
    nome: toOptionalString(data.nome ?? data.name) ?? "",
    status: toStatus(data.status),
    criadoEm: toOptionalString(data.criadoEm ?? data.createdAt),
  };
}

export async function listServices(opts?: { status?: string; limitTo?: number }) {
  const base = collection(db, "services");
  let q = query(base, orderBy("criadoEm", "desc"));
  if (opts?.status) q = query(base, where("status", "==", opts.status), orderBy("criadoEm", "desc"));
  if (opts?.limitTo) q = query(q, limit(opts.limitTo));
  const snap = await getDocs(q);
  return snap.docs.map((docSnap) => mapServiceSnapshot(docSnap));
}

export async function getService(id: string) {
  const ref = doc(db, "services", id);
  const snap = await getDoc(ref);
  return mapServiceDocument(snap);
}

export async function listPackages(opts?: { limitTo?: number }) {
  const base = collection(db, "packages");
  const q = opts?.limitTo
    ? query(base, orderBy("criadoEm", "desc"), limit(opts.limitTo))
    : query(base, orderBy("criadoEm", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((docSnap) => mapPackageSnapshot(docSnap));
}

export async function getPackage(id: string) {
  const ref = doc(db, "packages", id);
  const snap = await getDoc(ref);
  return mapPackageDocument(snap);
}
