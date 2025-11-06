import { NextResponse } from "next/server";
import type {
  DocumentSnapshot as AdminDocumentSnapshot,
  QueryDocumentSnapshot as AdminQueryDocumentSnapshot,
} from "firebase-admin/firestore";
import type {
  DocumentSnapshot as ClientDocumentSnapshot,
  QueryDocumentSnapshot as ClientQueryDocumentSnapshot,
} from "firebase/firestore";
import { tryGetAdminDb, getServerWebDb } from "@/lib/serverDb";

function normalizeCompany(raw?: unknown) {
  if (typeof raw !== "string") return "";
  return raw.trim().toLowerCase();
}

function toOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function extractTokenData(data: unknown, docId?: string | null) {
  const record = asRecord(data) ?? {};
  const scope = asRecord(record.scope);
  const scopeService = asRecord(scope?.service);

  const resolvedTargetId = toOptionalString(record.targetId) ?? toOptionalString(docId);
  const directServiceId =
    toOptionalString(record.serviceId) ??
    toOptionalString(scope?.serviceId) ??
    toOptionalString(scope?.targetId) ??
    toOptionalString(scopeService?.id);

  const directFolderId =
    toOptionalString((record as Record<string, unknown>).folderId) ??
    toOptionalString((record as Record<string, unknown>).pastaId) ??
    toOptionalString(scope?.folderId) ??
    toOptionalString(scope?.pastaId);

  const targetType = typeof record.targetType === "string" ? record.targetType : "";

  const serviceId = directServiceId ?? (targetType === "service" ? resolvedTargetId : null);
  const folderId = directFolderId ?? (targetType === "folder" ? resolvedTargetId : null);

  const empresa =
    toOptionalString(record.empresa) ??
    toOptionalString(record.empresaId) ??
    toOptionalString(scope?.empresaId) ??
    toOptionalString(scope?.company) ??
    toOptionalString(scope?.empresa) ??
    toOptionalString(record.company) ??
    toOptionalString(record.companyId);

  return {
    serviceId,
    folderId,
    empresa,
  };
}

function isServiceOpenRecord(data: Record<string, unknown>): boolean {
  const status = typeof data.status === "string" ? data.status.trim().toLowerCase() : "";
  if (!status) return true;
  return status === "aberto" || status === "aberta" || status === "open" || status === "pendente";
}

function extractServiceCompany(data: Record<string, unknown>): string {
  const candidates = [data.company, data.companyId, data.empresa, data.empresaId];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return normalizeCompany(value);
    }
  }
  return "";
}

async function fetchFolderServicesAdmin(folderId: string, empresa: string | null) {
  const adminDb = tryGetAdminDb();
  if (!adminDb) return [] as string[];

  const folderSnap = await adminDb.collection("packageFolders").doc(folderId).get();
  if (!folderSnap.exists) return [];

  const data = (folderSnap.data() ?? {}) as Record<string, unknown>;
  const services = Array.isArray(data.services)
    ? (data.services as unknown[])
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter((value) => value.length > 0)
    : [];

  const normalizedEmpresa = normalizeCompany(empresa ?? undefined);
  const folderCompany = normalizeCompany(data.companyId ?? data.company ?? data.empresa ?? undefined);
  if (normalizedEmpresa && folderCompany && normalizedEmpresa !== folderCompany) {
    return [];
  }

  const seen = new Set<string>();
  for (const serviceId of services) {
    if (seen.has(serviceId)) continue;
    const docSnap = await adminDb.collection("services").doc(serviceId).get();
    if (!docSnap.exists) continue;
    const serviceData = (docSnap.data() ?? {}) as Record<string, unknown>;
    if (!isServiceOpenRecord(serviceData)) continue;
    if (normalizedEmpresa) {
      const serviceCompany = extractServiceCompany(serviceData);
      if (serviceCompany && serviceCompany !== normalizedEmpresa) continue;
    }
    seen.add(docSnap.id);
  }

  return Array.from(seen);
}

async function fetchFolderServicesWeb(folderId: string, empresa: string | null) {
  const webDb = await getServerWebDb();
  const { collection, doc: docRef, getDoc } = await import("firebase/firestore");

  const folderRef = docRef(collection(webDb, "packageFolders"), folderId);
  const folderSnap = await getDoc(folderRef);
  if (!folderSnap.exists()) return [];

  const data = (folderSnap.data() ?? {}) as Record<string, unknown>;
  const services = Array.isArray(data.services)
    ? (data.services as unknown[])
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter((value) => value.length > 0)
    : [];

  const normalizedEmpresa = normalizeCompany(empresa ?? undefined);
  const folderCompany = normalizeCompany(data.companyId ?? data.company ?? data.empresa ?? undefined);
  if (normalizedEmpresa && folderCompany && normalizedEmpresa !== folderCompany) {
    return [];
  }

  const seen = new Set<string>();
  for (const serviceId of services) {
    if (seen.has(serviceId)) continue;
    const serviceRef = docRef(collection(webDb, "services"), serviceId);
    const serviceSnap = await getDoc(serviceRef);
    if (!serviceSnap.exists()) continue;
    const serviceData = (serviceSnap.data() ?? {}) as Record<string, unknown>;
    if (!isServiceOpenRecord(serviceData)) continue;
    if (normalizedEmpresa) {
      const serviceCompany = extractServiceCompany(serviceData);
      if (serviceCompany && serviceCompany !== normalizedEmpresa) continue;
    }
    seen.add(serviceSnap.id);
  }

  return Array.from(seen);
}

function isTokenActive(data: unknown) {
  const record = asRecord(data);
  if (!record) return true;
  if (typeof record.active === "boolean") return record.active;
  const status = typeof record.status === "string" ? record.status.toLowerCase() : "";
  if (!status) return true;
  return status === "active" || status === "ativo" || status === "aberto";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = (searchParams.get("token") || "").trim().toUpperCase();

  if (!token) {
    return NextResponse.json({ ok: false, error: "missing_token" }, { status: 400 });
  }

  try {
    const adminDb = tryGetAdminDb();
    if (adminDb) {
      const collectionRef = adminDb.collection("accessTokens");
      let doc: AdminDocumentSnapshot | AdminQueryDocumentSnapshot | null = null;

      const direct = await collectionRef.doc(token).get();
      if (direct.exists) {
        doc = direct;
      }

      if (!doc) {
        const snap = await collectionRef.where("code", "==", token).limit(1).get();
        doc = snap.docs[0] ?? null;
      }

      if (!doc) {
        const legacy = await collectionRef.where("token", "==", token).where("active", "==", true).limit(1).get();
        doc = legacy.docs[0] ?? null;
      }

      if (!doc) {
        return NextResponse.json({ ok: true, found: false, serviceIds: [] });
      }

      const data = doc.data() ?? {};
      if (!isTokenActive(data)) {
        return NextResponse.json({ ok: true, found: false, serviceIds: [] });
      }

      const { serviceId, folderId, empresa } = extractTokenData(data, doc.id);
      if (serviceId) {
        return NextResponse.json({ ok: true, found: true, serviceIds: [serviceId] });
      }

      if (folderId) {
        const serviceIds = await fetchFolderServicesAdmin(folderId, empresa);
        return NextResponse.json({ ok: true, found: serviceIds.length > 0, serviceIds });
      }

      return NextResponse.json({ ok: true, found: false, serviceIds: [] });
    }

    const webDb = await getServerWebDb();
    const { collection, doc: docRef, getDoc, getDocs, limit, query, where } = await import("firebase/firestore");
    const tokensCollection = collection(webDb, "accessTokens");
    let doc: ClientDocumentSnapshot | ClientQueryDocumentSnapshot | null = null;

    const byId = await getDoc(docRef(tokensCollection, token));
    if (byId.exists()) {
      doc = byId;
    }

    if (!doc) {
      const byCode = await getDocs(query(tokensCollection, where("code", "==", token), limit(1)));
      doc = byCode.docs[0] ?? null;
    }

    if (!doc) {
      const legacy = await getDocs(
        query(tokensCollection, where("token", "==", token), where("active", "==", true), limit(1)),
      );
      doc = legacy.docs[0] ?? null;
    }

    if (!doc) {
      return NextResponse.json({ ok: true, found: false, serviceIds: [] });
    }

    const data = doc.data() ?? {};
    if (!isTokenActive(data)) {
      return NextResponse.json({ ok: true, found: false, serviceIds: [] });
    }

    const { serviceId, folderId, empresa } = extractTokenData(data, doc.id);
    if (serviceId) {
      return NextResponse.json({ ok: true, found: true, serviceIds: [serviceId] });
    }

    if (folderId) {
      const serviceIds = await fetchFolderServicesWeb(folderId, empresa);
      return NextResponse.json({ ok: true, found: serviceIds.length > 0, serviceIds });
    }

    return NextResponse.json({ ok: true, found: false, serviceIds: [] });
  } catch (e) {
    console.error("[validate-token]", e);
    return NextResponse.json({ ok: false, error: "validate_failed" }, { status: 500 });
  }
}
