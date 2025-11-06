import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v1";
import { Timestamp } from "firebase-admin/firestore";
import type { Request, Response } from "express";

if (!admin.apps.length) admin.initializeApp();
const REGION = "southamerica-east1";

type TimestampLike = Timestamp | Date | { toMillis?: () => number } | number | null | undefined;

function asTimestamp(value: TimestampLike): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (!value) return null;

  if (value instanceof Timestamp) {
    return value.toMillis();
  }

  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.getTime() : null;
  }

  if (typeof value === "object" && typeof value.toMillis === "function") {
    const millis = value.toMillis();
    return Number.isFinite(millis) ? millis : null;
  }

  return null;
}

type AccessTokenData = FirebaseFirestore.DocumentData & {
  targetType?: "service" | "package" | string;
  targetId?: string;
  companyId?: string;
  company?: string;
  revoked?: boolean;
  active?: boolean;
  expiresAt?: TimestampLike;
  oneTime?: boolean;
};

type ServiceDoc = FirebaseFirestore.DocumentData & {
  status?: string;
  hasChecklist?: boolean;
  companyId?: string;
  company?: string;
};

type TargetDoc = FirebaseFirestore.DocumentData & {
  status?: string;
  companyId?: string;
  company?: string;
};

type ChecklistItem = {
  id: string;
  weight?: number;
  progress?: number;
};

const servicesCollection = () =>
  admin.firestore().collection("services") as FirebaseFirestore.CollectionReference<ServiceDoc>;

function sanitisePercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function inferChecklistStatus(progress: number): string {
  if (progress >= 100) return "concluido";
  if (progress > 0) return "andamento";
  return "nao_iniciado";
}

function docDataWithTimestamps(doc: FirebaseFirestore.DocumentSnapshot) {
  const data = doc.data() || {};
  const converted: Record<string, unknown> = { ...data };
  for (const [key, value] of Object.entries(converted)) {
    if (value instanceof admin.firestore.Timestamp) {
      converted[key] = value.toMillis();
    }
  }
  return converted;
}

function applyCors(req: Request, res: Response): boolean {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return true;
  }
  return false;
}

async function fetchAndValidateToken(
  tokenId: string,
): Promise<{
  tokenSnap: FirebaseFirestore.DocumentSnapshot<AccessTokenData>;
  tokenData: AccessTokenData;
}> {
  const tokenRef =
    admin
      .firestore()
      .collection("accessTokens") as FirebaseFirestore.CollectionReference<AccessTokenData>;
  const tokenSnap = await tokenRef.doc(tokenId).get();
  if (!tokenSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Token inválido");
  }

  const tokenData = tokenSnap.data() ?? ({} as AccessTokenData);
  if (tokenData.revoked === true || tokenData.active === false) {
    throw new functions.https.HttpsError("permission-denied", "Token inativo");
  }

  const expMillis = asTimestamp(tokenData.expiresAt);
  if (expMillis && expMillis < Date.now()) {
    throw new functions.https.HttpsError("deadline-exceeded", "Token expirado");
  }

  return { tokenSnap, tokenData };
}

function ensureCompanyMatch(
  tokenData: AccessTokenData,
  target: ServiceDoc | FirebaseFirestore.DocumentData,
) {
  const tokenCompany = tokenData.companyId || tokenData.company;
  if (!tokenCompany) return;

  const targetRecord = target as Record<string, unknown>;
  const targetCompany =
    typeof targetRecord.companyId === "string"
      ? targetRecord.companyId
      : typeof targetRecord.company === "string"
        ? targetRecord.company
        : undefined;
  if (targetCompany && targetCompany !== tokenCompany) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Token não possui acesso a este recurso",
    );
  }
}

async function validateServiceAccess(
  tokenId: string,
  serviceId: string,
): Promise<{
  tokenData: AccessTokenData;
  serviceSnap: FirebaseFirestore.DocumentSnapshot<ServiceDoc>;
}> {
  const { tokenData } = await fetchAndValidateToken(tokenId);

  if (tokenData.targetType !== "service" || tokenData.targetId !== serviceId) {
    throw new functions.https.HttpsError("permission-denied", "Token não corresponde ao serviço");
  }

  const serviceRef = servicesCollection().doc(serviceId);
  const serviceSnap = await serviceRef.get();
  if (!serviceSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Serviço não encontrado");
  }

  const serviceData = serviceSnap.data() || {};
  if (serviceData.status !== "aberto") {
    throw new functions.https.HttpsError("permission-denied", "Serviço não está aberto");
  }

  ensureCompanyMatch(tokenData, serviceData);

  return { tokenData, serviceSnap };
}

async function addManualUpdate(
  serviceId: string,
  percent: number,
  options: { note?: string; tokenId?: string } = {},
): Promise<number> {
  const sanitized = sanitisePercent(percent);
  const now = admin.firestore.FieldValue.serverTimestamp();

  await admin.firestore().runTransaction(async (tx) => {
    const serviceRef = servicesCollection().doc(serviceId);
    const updatesCol = serviceRef.collection("updates");

    const serviceSnap = await tx.get(serviceRef);
    if (!serviceSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Serviço não encontrado");
    }

    const updateRef = updatesCol.doc();
    const payload: Record<string, unknown> = {
      manualPercent: sanitized,
      realPercentSnapshot: sanitized,
      createdAt: now,
    };
    if (options.note !== undefined) payload.note = options.note;
    if (options.tokenId !== undefined) payload.token = options.tokenId;

    tx.set(updateRef, payload);

    tx.update(serviceRef, {
      realPercent: sanitized,
      manualPercent: sanitized,
      updatedAt: now,
    });
  });

  return sanitized;
}

async function updateChecklistProgress(
  serviceId: string,
  updates: Array<{ id: string; progress: number; status?: string }>,
): Promise<number> {
  if (!updates.length) {
    return computeRealPercentFromChecklist(serviceId);
  }

  const now = admin.firestore.FieldValue.serverTimestamp();

  const realPercent = await admin.firestore().runTransaction(async (tx) => {
    const serviceRef = servicesCollection().doc(serviceId);
    const checklistCol = serviceRef.collection("checklist");

    const serviceSnap = await tx.get(serviceRef);
    if (!serviceSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Serviço não encontrado");
    }

    const checklistSnap = await tx.get(checklistCol);
    const itemsMap = new Map<string, ChecklistItem>();

    checklistSnap.docs.forEach((doc) => {
      const data = (doc.data() || {}) as ChecklistItem;
      itemsMap.set(doc.id, { id: doc.id, weight: data.weight ?? 0, progress: data.progress ?? 0 });
    });

    updates.forEach((update) => {
      const existing = itemsMap.get(update.id);
      if (!existing) {
        throw new functions.https.HttpsError(
          "not-found",
          `Item do checklist ${update.id} não encontrado`,
        );
      }

      const progress = sanitisePercent(update.progress);
      const status = update.status ?? inferChecklistStatus(progress);
      itemsMap.set(update.id, { ...existing, progress });

      tx.update(checklistCol.doc(update.id), {
        progress,
        status,
        updatedAt: now,
      });
    });

    const items = Array.from(itemsMap.values());
    const totalWeight = items.reduce((acc, item) => acc + (item.weight ?? 0), 0);
    const percent = totalWeight
      ? items.reduce((acc, item) => acc + (item.progress ?? 0) * (item.weight ?? 0), 0) / totalWeight
      : 0;
    const result = Math.round(percent * 100) / 100;

    tx.update(serviceRef, {
      realPercent: result,
      manualPercent: admin.firestore.FieldValue.delete(),
      updatedAt: now,
    });

    return result;
  });

  return realPercent;
}

async function addComputedUpdate(
  serviceId: string,
  realPercent: number,
  options: { note?: string; tokenId?: string } = {},
) {
  const now = admin.firestore.FieldValue.serverTimestamp();
  await admin.firestore().runTransaction(async (tx) => {
    const serviceRef = servicesCollection().doc(serviceId);
    const updatesCol = serviceRef.collection("updates");

    const serviceSnap = await tx.get(serviceRef);
    if (!serviceSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Serviço não encontrado");
    }

    const updateRef = updatesCol.doc();
    const payload: Record<string, unknown> = {
      realPercentSnapshot: sanitisePercent(realPercent),
      createdAt: now,
    };
    if (options.note !== undefined) payload.note = options.note;
    if (options.tokenId !== undefined) payload.token = options.tokenId;

    tx.set(updateRef, payload);
  });
}

async function computeRealPercentFromChecklist(serviceId: string): Promise<number> {
  const checklistCol = servicesCollection().doc(serviceId).collection("checklist");
  const snap = await checklistCol.get();
  if (snap.empty) return 0;

  const items = snap.docs.map((doc) => {
    const data = doc.data() || {};
    return {
      weight: data.weight ?? 0,
      progress: data.progress ?? 0,
    };
  });
  const totalWeight = items.reduce((acc, item) => acc + (item.weight ?? 0), 0);
  if (!totalWeight) return 0;

  const percent =
    items.reduce((acc, item) => acc + (item.progress ?? 0) * (item.weight ?? 0), 0) /
    totalWeight;
  return Math.round(percent * 100) / 100;
}

export const claimAccessV2 = functions
  .region(REGION)
  .https.onCall(async (data, ctx) => {
    const { tokenId } = (data || {}) as { tokenId?: string };
    if (!tokenId) {
      throw new functions.https.HttpsError("invalid-argument", "tokenId requerido");
    }

    try {
      const tokenRef =
        admin
          .firestore()
          .collection("accessTokens") as FirebaseFirestore.CollectionReference<AccessTokenData>;
      const tokenSnap = await tokenRef.doc(tokenId).get();

      if (!tokenSnap.exists) {
        console.error("[claimAccessV2] token não encontrado:", tokenId);
        throw new functions.https.HttpsError("not-found", "Token inválido");
      }

      const t = tokenSnap.data() ?? ({} as AccessTokenData);
      const { targetType, targetId, companyId, revoked, oneTime, expiresAt } = t;

      if (revoked === true) throw new functions.https.HttpsError("permission-denied", "Token revogado");
      const expMillis = asTimestamp(expiresAt);
      if (expMillis && expMillis < Date.now()) throw new functions.https.HttpsError("deadline-exceeded", "Token expirado");

      if (!targetType || !targetId || (targetType !== "service" && targetType !== "package")) {
        console.error("[claimAccessV2] token malformado:", t);
        throw new functions.https.HttpsError("invalid-argument", "Token malformado");
      }

      const col = targetType === "service" ? "services" : "packages";
      const targetCollection = admin.firestore().collection(col) as FirebaseFirestore.CollectionReference<TargetDoc>;
      const targetSnap = await targetCollection.doc(targetId).get();
      if (!targetSnap.exists) throw new functions.https.HttpsError("not-found", "Alvo não encontrado");

      const target = targetSnap.data() ?? ({} as TargetDoc);
      if (target.status !== "aberto") {
        console.warn("[claimAccessV2] alvo fechado:", { col, targetId, status: target.status });
        throw new functions.https.HttpsError("permission-denied", "Alvo não está aberto");
      }

      const uid = `token:${tokenId}`;
      try { await admin.auth().getUser(uid); } catch { await admin.auth().createUser({ uid }); }

      const claims: Record<string, any> = { role: "third" };
      if (targetType === "service") claims.serviceId = targetId;
      if (targetType === "package") claims.packageId = targetId;
      if (companyId) claims.companyId = companyId;

      await admin.auth().setCustomUserClaims(uid, claims);
      if (oneTime === true) await tokenRef.update({ revoked: true });

      const customToken = await admin.auth().createCustomToken(uid, claims);
      return { customToken, targetType, targetId };
    } catch (err: any) {
      if (err instanceof functions.https.HttpsError) throw err;
      console.error("[claimAccessV2] erro inesperado:", err?.stack || err);
      throw new functions.https.HttpsError("internal", "Falha interna ao validar token");
    }
  });

export const publicServiceUpdateManual = functions
  .region(REGION)
  .https.onRequest(async (req, res) => {
    if (applyCors(req, res)) return;
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "Method not allowed" });
      return;
    }

    const serviceId = typeof req.query.serviceId === "string" ? req.query.serviceId : undefined;
    const tokenId = typeof req.query.token === "string" ? req.query.token : undefined;

    if (!serviceId || !tokenId) {
      res.status(400).json({ ok: false, error: "serviceId e token são obrigatórios" });
      return;
    }

    try {
      const { serviceSnap } = await validateServiceAccess(tokenId, serviceId);
      const serviceData = serviceSnap.data() || {};

      if (serviceData.hasChecklist) {
        res.status(400).json({ ok: false, error: "Serviço possui checklist, use a rota apropriada" });
        return;
      }

      const body = (req.body || {}) as { percent?: unknown; note?: unknown };
      const percent = Number(body.percent);
      if (!Number.isFinite(percent)) {
        res.status(400).json({ ok: false, error: "percent inválido" });
        return;
      }

      const note = typeof body.note === "string" ? body.note : undefined;
      const realPercent = await addManualUpdate(serviceId, percent, { note, tokenId });

      res.json({ ok: true, realPercent });
    } catch (err: any) {
      const status = err instanceof functions.https.HttpsError ? mapHttpsErrorCode(err.code) : 500;
      res.status(status).json({ ok: false, error: err?.message ?? "Erro interno" });
    }
  });

export const publicServiceUpdateChecklist = functions
  .region(REGION)
  .https.onRequest(async (req, res) => {
    if (applyCors(req, res)) return;
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "Method not allowed" });
      return;
    }

    const serviceId = typeof req.query.serviceId === "string" ? req.query.serviceId : undefined;
    const tokenId = typeof req.query.token === "string" ? req.query.token : undefined;

    if (!serviceId || !tokenId) {
      res.status(400).json({ ok: false, error: "serviceId e token são obrigatórios" });
      return;
    }

    try {
      const { serviceSnap } = await validateServiceAccess(tokenId, serviceId);
      const serviceData = serviceSnap.data() || {};

      if (!serviceData.hasChecklist) {
        res.status(400).json({ ok: false, error: "Serviço não possui checklist" });
        return;
      }

      const body = (req.body || {}) as {
        updates?: Array<{ id?: unknown; progress?: unknown; status?: unknown }>;
        note?: unknown;
      };

      if (!Array.isArray(body.updates)) {
        res.status(400).json({ ok: false, error: "updates deve ser um array" });
        return;
      }

      const updates = body.updates.map((item) => {
        const id = typeof item.id === "string" ? item.id : null;
        const progress = Number(item.progress);
        const status = typeof item.status === "string" ? item.status : undefined;
        if (!id || !Number.isFinite(progress)) {
          throw new functions.https.HttpsError("invalid-argument", "updates inválidos");
        }
        return { id, progress, status };
      });

      const note = typeof body.note === "string" ? body.note : undefined;

      const realPercent = await updateChecklistProgress(serviceId, updates);
      await addComputedUpdate(serviceId, realPercent, { note, tokenId });

      res.json({ ok: true, realPercent });
    } catch (err: any) {
      const status = err instanceof functions.https.HttpsError ? mapHttpsErrorCode(err.code) : 500;
      res.status(status).json({ ok: false, error: err?.message ?? "Erro interno" });
    }
  });

export const publicPackageServices = functions
  .region(REGION)
  .https.onRequest(async (req, res) => {
    if (applyCors(req, res)) return;
    if (req.method !== "GET") {
      res.status(405).json({ ok: false, error: "Method not allowed" });
      return;
    }

    const packageId = typeof req.query.packageId === "string" ? req.query.packageId : undefined;
    const tokenId = typeof req.query.token === "string" ? req.query.token : undefined;

    if (!packageId || !tokenId) {
      res.status(400).json({ ok: false, error: "packageId e token são obrigatórios" });
      return;
    }

    try {
      const { tokenData } = await fetchAndValidateToken(tokenId);

      if (tokenData.targetType !== "package" || tokenData.targetId !== packageId) {
        throw new functions.https.HttpsError("permission-denied", "Token não corresponde ao pacote");
      }

      const packageSnap = await admin.firestore().collection("packages").doc(packageId).get();
      if (!packageSnap.exists) {
        res.status(404).json({ ok: false, error: "Pacote não encontrado" });
        return;
      }

      const servicesSnap = await servicesCollection().where("packageId", "==", packageId).get();
      const tokenCompany = tokenData.companyId || tokenData.company;

      const services = servicesSnap.docs
        .filter((doc) => {
          if (!tokenCompany) return true;
          const data = doc.data() || {};
          const serviceCompany = data.companyId ?? data.company;
          return !serviceCompany || serviceCompany === tokenCompany;
        })
        .map((doc) => ({ id: doc.id, ...docDataWithTimestamps(doc) }));

      res.json({ ok: true, services });
    } catch (err: any) {
      const status = err instanceof functions.https.HttpsError ? mapHttpsErrorCode(err.code) : 500;
      res.status(status).json({ ok: false, error: err?.message ?? "Erro interno" });
    }
  });

function mapHttpsErrorCode(code: functions.https.FunctionsErrorCode): number {
  switch (code) {
    case "invalid-argument":
      return 400;
    case "not-found":
      return 404;
    case "permission-denied":
      return 403;
    case "deadline-exceeded":
      return 408;
    default:
      return 500;
  }
}
