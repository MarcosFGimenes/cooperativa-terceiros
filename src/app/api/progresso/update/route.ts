import { NextRequest, NextResponse } from "next/server";
import { Timestamp, type Firestore } from "firebase-admin/firestore";

import { tryGetAdminDb, getServerWebDb } from "@/lib/serverDb";

function isTokenActive(data: any) {
  if (typeof data?.active === "boolean") return data.active;
  const status = typeof data?.status === "string" ? data.status.toLowerCase() : "";
  if (!status) return true;
  return status === "active" || status === "ativo" || status === "aberto";
}

function parseTokenScope(data: any) {
  if (data?.scope?.type === "service" && typeof data.scope.serviceId === "string") {
    return { type: "service" as const, serviceId: data.scope.serviceId };
  }
  if (data?.scope?.type === "packageCompany") {
    const packageId =
      typeof data.scope.pacoteId === "string"
        ? data.scope.pacoteId
        : typeof data.scope.packageId === "string"
          ? data.scope.packageId
          : undefined;
    const empresa =
      typeof data.scope.empresaId === "string"
        ? data.scope.empresaId
        : typeof data.scope.company === "string"
          ? data.scope.company
          : undefined;
    if (packageId) return { type: "package" as const, packageId, empresa };
  }
  if (typeof data?.serviceId === "string" && data.serviceId) {
    return { type: "service" as const, serviceId: data.serviceId };
  }
  const packageId =
    typeof data?.packageId === "string"
      ? data.packageId
      : typeof data?.pacoteId === "string"
        ? data.pacoteId
        : undefined;
  if (packageId) {
    const empresa =
      typeof data?.empresa === "string"
        ? data.empresa
        : typeof data?.empresaId === "string"
          ? data.empresaId
          : undefined;
    return { type: "package" as const, packageId, empresa };
  }
  return null;
}

function normalizeCompany(value?: string | null) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

async function handleWithAdmin(
  adminDb: Firestore,
  req: NextRequest,
  payload: {
    token: string;
    serviceId: string;
    items?: Array<{ itemId: string; pct: number }>;
    totalPct?: number;
    note?: string;
    date?: string;
  },
) {
  const upperToken = payload.token;
  const byCode = await adminDb.collection("accessTokens").where("code", "==", upperToken).limit(1).get();
  let doc = byCode.docs[0];
  if (!doc) {
    const legacy = await adminDb.collection("accessTokens").where("token", "==", upperToken).limit(1).get();
    doc = legacy.docs[0];
  }
  if (!doc) {
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 403 });
  }
  const tokenData = doc.data() ?? {};
  if (!isTokenActive(tokenData)) {
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 403 });
  }

  const scope = parseTokenScope(tokenData);
  if (!scope) {
    return NextResponse.json({ ok: false, error: "invalid_scope" }, { status: 403 });
  }

  const serviceRef = adminDb.collection("services").doc(payload.serviceId);
  const serviceSnap = await serviceRef.get();
  if (!serviceSnap.exists) {
    return NextResponse.json({ ok: false, error: "service_not_found" }, { status: 404 });
  }
  const serviceData = serviceSnap.data() ?? {};

  if (scope.type === "service" && scope.serviceId !== payload.serviceId) {
    return NextResponse.json({ ok: false, error: "forbidden_scope" }, { status: 403 });
  }

  if (scope.type === "package") {
    const pkgId = scope.packageId;
    const empresaToken = normalizeCompany(scope.empresa);
    const svcPackage =
      typeof serviceData.packageId === "string"
        ? serviceData.packageId
        : typeof serviceData.pacoteId === "string"
          ? serviceData.pacoteId
          : "";
    if (pkgId && svcPackage !== pkgId) {
      return NextResponse.json({ ok: false, error: "forbidden_scope" }, { status: 403 });
    }
    if (empresaToken) {
      const svcCompany = normalizeCompany(serviceData.empresaId ?? serviceData.company ?? "");
      if (svcCompany && svcCompany !== empresaToken) {
        return NextResponse.json({ ok: false, error: "forbidden_scope" }, { status: 403 });
      }
    }
  }

  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const ip = forwarded?.split(",")[0]?.trim() || realIp?.trim();

  let updateDate = Timestamp.now();
  if (payload.date) {
    const parsed = new Date(payload.date);
    if (!Number.isNaN(parsed.getTime())) {
      updateDate = Timestamp.fromDate(parsed);
    }
  }

  const update: any = {
    date: updateDate,
    note: typeof payload.note === "string" && payload.note.trim() ? payload.note.trim() : undefined,
    by: "token",
    items: Array.isArray(payload.items) ? payload.items : undefined,
    totalPct: typeof payload.totalPct === "number" ? payload.totalPct : undefined,
    tokenId: doc.id,
    ip: ip || undefined,
  };

  await serviceRef.collection("serviceUpdates").add(update);

  let novo = 0;
  const checklist = Array.isArray(serviceData.checklist) ? serviceData.checklist : [];
  if (checklist.length > 0) {
    const pesoById = new Map<string, number>();
    for (const item of checklist) {
      const id = String(item.id ?? "");
      if (!id) continue;
      const peso = Number(item.peso ?? 0);
      pesoById.set(id, peso);
    }
    const all = await serviceRef.collection("serviceUpdates").orderBy("date", "asc").get();
    const latest = new Map<string, number>();
    for (const entry of all.docs) {
      const data = entry.data() ?? {};
      const items = Array.isArray(data.items) ? data.items : [];
      for (const item of items) {
        const itemId = String(item.itemId ?? "");
        const pct = Number(item.pct ?? 0);
        latest.set(itemId, pct);
      }
    }
    let soma = 0;
    for (const [itemId, peso] of pesoById) {
      const pct = latest.get(itemId) ?? 0;
      soma += (peso * pct) / 100;
    }
    novo = Math.max(0, Math.min(100, soma));
  } else {
    const all = await serviceRef.collection("serviceUpdates").orderBy("date", "asc").get();
    for (const entry of all.docs) {
      const data = entry.data() ?? {};
      if (typeof data.totalPct === "number") {
        novo = Number(data.totalPct);
      }
    }
    novo = Math.max(0, Math.min(100, novo));
  }

  await serviceRef.update({ andamento: novo, updatedAt: Timestamp.now() });

  return NextResponse.json({ ok: true, andamento: novo });
}

async function handleWithWeb(
  req: NextRequest,
  payload: {
    token: string;
    serviceId: string;
    items?: Array<{ itemId: string; pct: number }>;
    totalPct?: number;
    note?: string;
    date?: string;
  },
) {
  const db = await getServerWebDb();
  const { collection, query, where, limit, getDocs, doc, getDoc, updateDoc, addDoc, orderBy, serverTimestamp, Timestamp } =
    await import("firebase/firestore");

  const upperToken = payload.token;
  let q = query(collection(db, "accessTokens"), where("code", "==", upperToken), limit(1));
  let snap = await getDocs(q);
  if (snap.empty) {
    q = query(collection(db, "accessTokens"), where("token", "==", upperToken), limit(1));
    snap = await getDocs(q);
  }
  if (snap.empty) {
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 403 });
  }

  const tokenDoc = snap.docs[0];
  const tokenData = tokenDoc.data() ?? {};
  if (!isTokenActive(tokenData)) {
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 403 });
  }

  const scope = parseTokenScope(tokenData);
  if (!scope) {
    return NextResponse.json({ ok: false, error: "invalid_scope" }, { status: 403 });
  }

  const serviceRef = doc(db, "services", payload.serviceId);
  const serviceSnap = await getDoc(serviceRef);
  if (!serviceSnap.exists()) {
    return NextResponse.json({ ok: false, error: "service_not_found" }, { status: 404 });
  }
  const serviceData = serviceSnap.data() ?? {};

  if (scope.type === "service" && scope.serviceId !== payload.serviceId) {
    return NextResponse.json({ ok: false, error: "forbidden_scope" }, { status: 403 });
  }

  if (scope.type === "package") {
    const pkgId = scope.packageId;
    const empresaToken = normalizeCompany(scope.empresa);
    const svcPackage =
      typeof serviceData.packageId === "string"
        ? serviceData.packageId
        : typeof serviceData.pacoteId === "string"
          ? serviceData.pacoteId
          : "";
    if (pkgId && svcPackage !== pkgId) {
      return NextResponse.json({ ok: false, error: "forbidden_scope" }, { status: 403 });
    }
    if (empresaToken) {
      const svcCompany = normalizeCompany((serviceData as any).empresaId ?? (serviceData as any).company ?? "");
      if (svcCompany && svcCompany !== empresaToken) {
        return NextResponse.json({ ok: false, error: "forbidden_scope" }, { status: 403 });
      }
    }
  }

  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const ip = forwarded?.split(",")[0]?.trim() || realIp?.trim();

  let dateValue: any = serverTimestamp();
  if (payload.date) {
    const parsed = new Date(payload.date);
    if (!Number.isNaN(parsed.getTime())) {
      dateValue = Timestamp.fromDate(parsed);
    }
  }

  const updatesRef = collection(serviceRef, "serviceUpdates");
  await addDoc(updatesRef, {
    date: dateValue,
    note: typeof payload.note === "string" && payload.note.trim() ? payload.note.trim() : undefined,
    by: "token",
    items: Array.isArray(payload.items) ? payload.items : undefined,
    totalPct: typeof payload.totalPct === "number" ? payload.totalPct : undefined,
    tokenId: tokenDoc.id,
    ip: ip || undefined,
  });

  let novo = 0;
  const checklist = Array.isArray(serviceData.checklist) ? serviceData.checklist : [];
  if (checklist.length > 0) {
    const pesoById = new Map<string, number>();
    for (const item of checklist) {
      const id = String((item as any).id ?? "");
      if (!id) continue;
      const peso = Number((item as any).peso ?? 0);
      pesoById.set(id, peso);
    }
    const all = await getDocs(query(updatesRef, orderBy("date", "asc")));
    const latest = new Map<string, number>();
    all.forEach((docSnap) => {
      const data = docSnap.data() ?? {};
      const items = Array.isArray((data as any).items) ? (data as any).items : [];
      for (const item of items) {
        const itemId = String(item.itemId ?? "");
        const pct = Number(item.pct ?? 0);
        latest.set(itemId, pct);
      }
    });
    let soma = 0;
    for (const [itemId, peso] of pesoById) {
      const pct = latest.get(itemId) ?? 0;
      soma += (peso * pct) / 100;
    }
    novo = Math.max(0, Math.min(100, soma));
  } else {
    const all = await getDocs(query(updatesRef, orderBy("date", "asc")));
    all.forEach((docSnap) => {
      const data = docSnap.data() ?? {};
      if (typeof (data as any).totalPct === "number") {
        novo = Number((data as any).totalPct);
      }
    });
    novo = Math.max(0, Math.min(100, novo));
  }

  await updateDoc(serviceRef, { andamento: novo, updatedAt: serverTimestamp() });

  return NextResponse.json({ ok: true, andamento: novo });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, serviceId, items, totalPct, note, date } = body ?? {};
    if (!token || typeof token !== "string" || !serviceId || typeof serviceId !== "string") {
      return NextResponse.json({ ok: false, error: "missing_params" }, { status: 400 });
    }

    const upperToken = token.trim().toUpperCase();
    const payload = {
      token: upperToken,
      serviceId: serviceId.trim(),
      items,
      totalPct,
      note,
      date,
    };

    const adminDb = tryGetAdminDb();
    if (adminDb) {
      return await handleWithAdmin(adminDb, req, payload);
    }

    return await handleWithWeb(req, payload);
  } catch (e) {
    console.error("[progresso/update]", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
