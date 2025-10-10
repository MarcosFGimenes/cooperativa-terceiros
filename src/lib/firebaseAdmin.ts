import * as admin from "firebase-admin";

type GlobalWithAdmin = typeof global & { _adminApp?: admin.app.App };

/**
 * Inicializa o Admin SDK de forma robusta:
 * - Se FIREBASE_ADMIN_JSON_BASE64 existir, usa esse JSON (mais fácil de configurar).
 * - Senão, usa PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY (com suporte a \n).
 */
function getAdminAppInternal() {
  const g = global as GlobalWithAdmin;
  if (g._adminApp) return g._adminApp;

  const jsonB64 = process.env.FIREBASE_ADMIN_JSON_BASE64;

  let app: admin.app.App | null = null;

  if (jsonB64 && jsonB64.trim() !== "") {
    try {
      const jsonStr = Buffer.from(jsonB64, "base64").toString("utf8");
      const creds = JSON.parse(jsonStr);
      app = admin.initializeApp({
        credential: admin.credential.cert(creds),
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[firebaseAdmin] Falha ao parsear FIREBASE_ADMIN_JSON_BASE64:", e);
      throw new Error("Config Admin inválida (JSON base64).");
    }
  } else {
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY || "";

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error("Config Admin ausente. Defina FIREBASE_ADMIN_JSON_BASE64 ou as três variáveis *_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY.");
    }

    // Converte sequências '\n' em quebras reais
    privateKey = privateKey.replace(/\\n/g, "\n");

    try {
      app = admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[firebaseAdmin] Falha ao inicializar com PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY:", e);
      throw new Error("Config Admin inválida (PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY). Verifique quebras de linha da PRIVATE_KEY.");
    }
  }

  (global as GlobalWithAdmin)._adminApp = app!;
  return app!;
}

export function getAdminApp() {
  return getAdminAppInternal();
}

export const adminAuth = () => getAdminApp().auth();
export const adminDb = () => getAdminApp().firestore();
