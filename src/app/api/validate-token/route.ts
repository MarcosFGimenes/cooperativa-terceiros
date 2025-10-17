import { NextResponse } from "next/server";
import { tryGetAdminDb, getServerWebDb } from "@/lib/serverDb";

function normalizeCompany(raw?: unknown) {
  if (typeof raw !== "string") return "";
  return raw.trim().toLowerCase();
}

function extractTokenData(data: any) {
  const serviceId =
    data?.serviceId ?? data?.scope?.serviceId ?? data?.scope?.targetId ?? data?.scope?.service?.id ?? null;
  const packageId =
    data?.packageId ?? data?.pacoteId ?? data?.scope?.pacoteId ?? data?.scope?.packageId ?? data?.scope?.targetId ?? null;
  const empresa =
    data?.empresa ??
    data?.empresaId ??
    data?.scope?.empresaId ??
    data?.scope?.company ??
    data?.scope?.empresa ??
    null;
  return {
    serviceId: typeof serviceId === "string" && serviceId ? serviceId : null,
    packageId: typeof packageId === "string" && packageId ? packageId : null,
    empresa: typeof empresa === "string" && empresa ? empresa : null,
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
      const snap = await adminDb.collection("accessTokens").where("code", "==", token).limit(1).get();
      let doc = snap.docs[0];
      if (!doc) {
        const legacy = await adminDb
          .collection("accessTokens")
          .where("token", "==", token)
          .where("active", "==", true)
          .limit(1)
          .get();
        doc = legacy.docs[0];
      }

      if (!doc) {
        return NextResponse.json({ ok: true, found: false, serviceIds: [] });
      }

      const data = doc.data() ?? {};
      if (!isTokenActive(data)) {
        return NextResponse.json({ ok: true, found: false, serviceIds: [] });
      }

      const { serviceId, packageId, empresa } = extractTokenData(data);
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
    const { collection, getDocs, query, where, limit } = await import("firebase/firestore");
    let q = query(collection(webDb, "accessTokens"), where("code", "==", token), limit(1));
    let snap = await getDocs(q);
    if (snap.empty) {
      q = query(
        collection(webDb, "accessTokens"),
        where("token", "==", token),
        where("active", "==", true),
        limit(1),
      );
      snap = await getDocs(q);
    }
    if (snap.empty) {
      return NextResponse.json({ ok: true, found: false, serviceIds: [] });
    }

    const doc = snap.docs[0];
    const data = doc.data() ?? {};
    if (!isTokenActive(data)) {
      return NextResponse.json({ ok: true, found: false, serviceIds: [] });
    }

    const { serviceId, packageId, empresa } = extractTokenData(data);
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
