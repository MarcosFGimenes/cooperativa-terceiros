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

function extractTokenData(data: any, docId?: string | null) {
  const resolvedTargetId = toOptionalString(data?.targetId) ?? toOptionalString(docId);
  const directServiceId =
    toOptionalString(data?.serviceId) ??
    toOptionalString(data?.scope?.serviceId) ??
    toOptionalString(data?.scope?.targetId) ??
    toOptionalString(data?.scope?.service?.id);
  const directPackageId =
    toOptionalString(data?.packageId) ??
    toOptionalString(data?.pacoteId) ??
    toOptionalString(data?.scope?.pacoteId) ??
    toOptionalString(data?.scope?.packageId) ??
    toOptionalString(data?.scope?.targetId);

  const targetType = typeof data?.targetType === "string" ? data.targetType : "";

  const serviceId = directServiceId ?? (targetType === "service" ? resolvedTargetId : null);
  const packageId = directPackageId ?? (targetType === "package" ? resolvedTargetId : null);

  const empresa =
    toOptionalString(data?.empresa) ??
    toOptionalString(data?.empresaId) ??
    toOptionalString(data?.scope?.empresaId) ??
    toOptionalString(data?.scope?.company) ??
    toOptionalString(data?.scope?.empresa) ??
    toOptionalString(data?.company) ??
    toOptionalString(data?.companyId);

  return {
    serviceId,
    packageId,
    empresa,
  };
}

async function fetchPackageServicesAdmin(pkgId: string, empresa: string | null) {
  const adminDb = tryGetAdminDb();
  if (!adminDb) return [] as string[];
  const normalizedEmpresa = normalizeCompany(empresa ?? undefined);
  const seen = new Set<string>();
  const snapshots = await Promise.all([
    adminDb.collection("services").where("packageId", "==", pkgId).get(),
    adminDb.collection("services").where("pacoteId", "==", pkgId).get(),
  ]);
  for (const snap of snapshots) {
    for (const doc of snap.docs) {
      const data = doc.data() ?? {};
      const status = String(data.status ?? "").toLowerCase();
      if (status && status !== "aberto") continue;
      const company = normalizeCompany(data.empresaId ?? data.company ?? "");
      if (normalizedEmpresa && company && company !== normalizedEmpresa) continue;
      seen.add(doc.id);
    }
  }
  return Array.from(seen);
}

async function fetchPackageServicesWeb(pkgId: string, empresa: string | null) {
  const webDb = await getServerWebDb();
  const { collection, getDocs, query, where } = await import("firebase/firestore");
  const normalizedEmpresa = normalizeCompany(empresa ?? undefined);
  const seen = new Set<string>();
  const queries = [
    query(collection(webDb, "services"), where("packageId", "==", pkgId)),
    query(collection(webDb, "services"), where("pacoteId", "==", pkgId)),
  ];
  for (const q of queries) {
    const snap = await getDocs(q);
    snap.forEach((doc) => {
      const data = doc.data() ?? {};
      const status = String((data as any).status ?? "").toLowerCase();
      if (status && status !== "aberto") return;
      const company = normalizeCompany((data as any).empresaId ?? (data as any).company ?? "");
      if (normalizedEmpresa && company && company !== normalizedEmpresa) return;
      seen.add(doc.id);
    });
  }
  return Array.from(seen);
}

function isTokenActive(data: any) {
  if (typeof data?.active === "boolean") return data.active;
  const status = typeof data?.status === "string" ? data.status.toLowerCase() : "";
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

      const { serviceId, packageId, empresa } = extractTokenData(data, doc.id);
      if (serviceId) {
        return NextResponse.json({ ok: true, found: true, serviceIds: [serviceId] });
      }

      if (packageId) {
        const serviceIds = await fetchPackageServicesAdmin(packageId, empresa);
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

    const { serviceId, packageId, empresa } = extractTokenData(data, doc.id);
    if (serviceId) {
      return NextResponse.json({ ok: true, found: true, serviceIds: [serviceId] });
    }

    if (packageId) {
      const serviceIds = await fetchPackageServicesWeb(packageId, empresa);
      return NextResponse.json({ ok: true, found: serviceIds.length > 0, serviceIds });
    }

    return NextResponse.json({ ok: true, found: false, serviceIds: [] });
  } catch (e) {
    console.error("[validate-token]", e);
    return NextResponse.json({ ok: false, error: "validate_failed" }, { status: 500 });
  }
}
