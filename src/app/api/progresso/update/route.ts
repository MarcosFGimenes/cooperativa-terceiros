import { NextRequest, NextResponse } from "next/server";
import { Timestamp, type Firestore } from "firebase-admin/firestore";

import { AdminDbUnavailableError, getAdminDbOrThrow } from "@/lib/serverDb";
import { mapFirestoreError } from "@/lib/utils/firestoreErrors";

type TokenScope =
  | { type: "service"; serviceId: string }
  | { type: "folder"; folderId: string; packageId?: string | null; empresa?: string | null };

type ChecklistEntry = { id: string; peso: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getStringField(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return undefined;
}

function isTokenActive(data: unknown) {
  if (!isRecord(data)) return true;
  if (typeof data.active === "boolean") return data.active;
  const status = typeof data.status === "string" ? data.status.toLowerCase() : "";
  if (!status) return true;
  return status === "active" || status === "ativo" || status === "aberto";
}

function parseTokenScope(data: unknown): TokenScope | null {
  if (!isRecord(data)) return null;
  const scope = isRecord(data.scope) ? (data.scope as Record<string, unknown>) : undefined;
  const scopeService = scope && isRecord(scope.service) ? (scope.service as Record<string, unknown>) : undefined;

  const scopeType = typeof scope?.type === "string" ? scope.type.toLowerCase() : "";

  if (scopeType === "service") {
    const serviceId =
      getStringField(scope, "serviceId", "targetId") ||
      (scopeService ? getStringField(scopeService, "id") : undefined);
    if (serviceId) {
      return { type: "service", serviceId };
    }
  }

  if (scopeType === "folder") {
    const folderId = getStringField(scope, "folderId", "pastaId", "targetId");
    if (folderId) {
      const packageId = getStringField(scope, "packageId", "pacoteId");
      const empresa = getStringField(scope, "empresa", "empresaId", "company");
      return { type: "folder", folderId, packageId, empresa };
    }
  }

  const resolvedTargetId = getStringField(data, "targetId");
  const targetType = typeof data.targetType === "string" ? data.targetType.toLowerCase() : "";

  const directService =
    getStringField(data, "serviceId") ||
    (scope ? getStringField(scope, "serviceId") : undefined) ||
    (scopeService ? getStringField(scopeService, "id") : undefined) ||
    (targetType === "service" ? resolvedTargetId : undefined);
  if (directService) {
    return { type: "service", serviceId: directService };
  }

  const folderId =
    getStringField(data, "folderId", "pastaId") ||
    (scope ? getStringField(scope, "folderId", "pastaId") : undefined) ||
    (targetType === "folder" ? resolvedTargetId : undefined) ||
    (scope ? getStringField(scope, "targetId") : undefined);

  if (folderId) {
    const packageId =
      getStringField(data, "packageId", "pacoteId") ||
      (scope ? getStringField(scope, "packageId", "pacoteId") : undefined);
    const empresa =
      getStringField(data, "empresa", "empresaId", "company", "companyId") ||
      (scope ? getStringField(scope, "empresa", "empresaId", "company") : undefined);
    return { type: "folder", folderId, packageId, empresa };
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
  const tokenData = (doc.data() ?? {}) as Record<string, unknown>;
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
  const serviceData = (serviceSnap.data() ?? {}) as Record<string, unknown>;

  if (scope.type === "service" && scope.serviceId !== payload.serviceId) {
    return NextResponse.json({ ok: false, error: "forbidden_scope" }, { status: 403 });
  }

  if (scope.type === "folder") {
    const folderRef = adminDb.collection("packageFolders").doc(scope.folderId);
    const folderSnap = await folderRef.get();
    if (!folderSnap.exists) {
      return NextResponse.json({ ok: false, error: "forbidden_scope" }, { status: 403 });
    }

    const folderData = (folderSnap.data() ?? {}) as Record<string, unknown>;
    const services = Array.isArray(folderData.services)
      ? (folderData.services as unknown[])
          .map((value) => (typeof value === "string" ? value.trim() : ""))
          .filter((value) => value.length > 0)
      : [];
    if (!services.includes(payload.serviceId)) {
      return NextResponse.json({ ok: false, error: "forbidden_scope" }, { status: 403 });
    }

    const empresaToken = normalizeCompany(scope.empresa ?? null);
    const folderCompany = normalizeCompany(
      getStringField(folderData, "companyId", "company", "empresa") ?? null,
    );
    if (empresaToken && folderCompany && folderCompany !== empresaToken) {
      return NextResponse.json({ ok: false, error: "forbidden_scope" }, { status: 403 });
    }

    if (empresaToken) {
      const svcCompany = normalizeCompany(
        getStringField(serviceData, "empresaId", "company", "empresa") ?? null,
      );
      if (svcCompany && svcCompany !== empresaToken) {
        return NextResponse.json({ ok: false, error: "forbidden_scope" }, { status: 403 });
      }
    }

    const expectedPackage = scope.packageId ?? getStringField(folderData, "packageId", "pacoteId") ?? null;
    if (expectedPackage) {
      const svcPackage = getStringField(serviceData, "packageId", "pacoteId") ?? null;
      if (svcPackage && svcPackage !== expectedPackage) {
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

  const update: {
    date: Timestamp;
    note?: string;
    by: "token";
    items?: Array<{ itemId: string; pct: number }>;
    totalPct?: number;
    tokenId: string;
    ip?: string;
  } = {
    date: updateDate,
    note: typeof payload.note === "string" && payload.note.trim() ? payload.note.trim() : undefined,
    by: "token",
    items: payload.items && payload.items.length > 0 ? payload.items : undefined,
    totalPct: typeof payload.totalPct === "number" ? payload.totalPct : undefined,
    tokenId: doc.id,
    ip: ip || undefined,
  };

  await serviceRef.collection("serviceUpdates").add(update);

  let novo = 0;
  const checklistRaw = Array.isArray(serviceData.checklist) ? serviceData.checklist : [];
  const checklist: ChecklistEntry[] = [];
  checklistRaw.forEach((entry, index) => {
    if (!isRecord(entry)) return;
    const idValue = getStringField(entry, "id", "itemId");
    const pesoValue = entry.peso ?? entry.weight;
    const pesoNumber = typeof pesoValue === "number" ? pesoValue : Number(pesoValue ?? 0);
    if (!Number.isFinite(pesoNumber)) return;
    checklist.push({ id: idValue || `item-${index}`, peso: pesoNumber });
  });
  
  // Se não há checklist no serviço mas há items no payload, criar checklist padrão "GERAL"
  if (checklist.length === 0 && payload.items && payload.items.length > 0) {
    checklist.push({ id: "default-geral", peso: 100 });
  }
  
  // Se há checklist ou items, calcular baseado no checklist
  if (checklist.length > 0 || (payload.items && payload.items.length > 0)) {
    const pesoById = new Map<string, number>();
    for (const item of checklist) {
      const id = item.id;
      if (!id) continue;
      const peso = item.peso;
      pesoById.set(id, peso);
    }
    const all = await serviceRef.collection("serviceUpdates").orderBy("date", "asc").get();
    const latest = new Map<string, number>();
    for (const entry of all.docs) {
      const data = (entry.data() ?? {}) as Record<string, unknown>;
      const itemsRaw = Array.isArray(data.items) ? data.items : [];
      for (const item of itemsRaw) {
        if (!isRecord(item)) continue;
        const itemId = getStringField(item, "itemId", "id");
        if (!itemId) continue;
        const pctValue = typeof item.pct === "number" ? item.pct : Number(item.pct ?? 0);
        if (!Number.isFinite(pctValue)) continue;
        latest.set(itemId, pctValue);
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
      const data = (entry.data() ?? {}) as Record<string, unknown>;
      if (typeof data.totalPct === "number") {
        novo = Number(data.totalPct);
      }
    }
    novo = Math.max(0, Math.min(100, novo));
  }

  await serviceRef.update({ andamento: novo, updatedAt: Timestamp.now() });

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

    const adminDb = getAdminDbOrThrow();
    return await handleWithAdmin(adminDb, req, payload);
  } catch (error) {
    if (error instanceof AdminDbUnavailableError || (error instanceof Error && error.message === "FIREBASE_ADMIN_NOT_CONFIGURED")) {
      console.error("[progresso/update] Firebase Admin não configurado", error);
      return NextResponse.json({ ok: false, error: "Configuração de acesso ao banco indisponível." }, { status: 500 });
    }

    const mapped = mapFirestoreError(error);
    if (mapped) {
      console.warn("[progresso/update] Falha de permissão ou recurso", error);
      return NextResponse.json({ ok: false, error: mapped.message }, { status: mapped.status });
    }

    console.error("[progresso/update] Erro inesperado", error);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
