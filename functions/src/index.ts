import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v1";

if (!admin.apps.length) admin.initializeApp();
const REGION = "southamerica-east1";

function asTimestamp(v: any): number | null {
  try {
    // @ts-ignore
    if (v && typeof v.toMillis === "function") return v.toMillis();
    if (v instanceof Date) return v.getTime();
  } catch {}
  return null;
}

export const claimAccessV2 = functions
  .region(REGION)
  .https.onCall(async (data, ctx) => {
    const { tokenId } = (data || {}) as { tokenId?: string };
    if (!tokenId) {
      throw new functions.https.HttpsError("invalid-argument", "tokenId requerido");
    }

    try {
      const tokenRef = admin.firestore().collection("accessTokens").doc(tokenId);
      const tokenSnap = await tokenRef.get();

      if (!tokenSnap.exists) {
        console.error("[claimAccessV2] token não encontrado:", tokenId);
        throw new functions.https.HttpsError("not-found", "Token inválido");
      }

      const t = tokenSnap.data() as any;
      const { targetType, targetId, companyId, revoked, oneTime, expiresAt } = t || {};
      console.log("[claimAccessV2] token", { tokenId, targetType, targetId, companyId, revoked, oneTime });

      if (revoked === true) throw new functions.https.HttpsError("permission-denied", "Token revogado");
      const expMillis = asTimestamp(expiresAt);
      if (expMillis && expMillis < Date.now()) throw new functions.https.HttpsError("deadline-exceeded", "Token expirado");

      if (!targetType || !targetId || (targetType !== "service" && targetType !== "package")) {
        console.error("[claimAccessV2] token malformado:", t);
        throw new functions.https.HttpsError("invalid-argument", "Token malformado");
      }

      const col = targetType === "service" ? "services" : "packages";
      const targetSnap = await admin.firestore().collection(col).doc(targetId).get();
      if (!targetSnap.exists) throw new functions.https.HttpsError("not-found", "Alvo não encontrado");

      const target = targetSnap.data() as any;
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
