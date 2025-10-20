// server-only
import "server-only";
import type { App } from "firebase-admin/app";

type ServiceAccountConfig = {
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
};

let adminApp: App | null = null;

function readServiceAccountFromBase64(): ServiceAccountConfig | null {
  const base64 =
    process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || process.env.FIREBASE_ADMIN_JSON_BASE64;

  if (!base64) return null;

  try {
    const trimmed = base64.trim();
    if (!trimmed) return null;
    const decoded = Buffer.from(trimmed, "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as {
      project_id?: string;
      projectId?: string;
      client_email?: string;
      clientEmail?: string;
      private_key?: string;
      privateKey?: string;
    };

    return {
      projectId: parsed.project_id ?? parsed.projectId,
      clientEmail: parsed.client_email ?? parsed.clientEmail,
      privateKey: parsed.private_key ?? parsed.privateKey,
    };
  } catch (error) {
    console.error("[firebaseAdmin] Falha ao ler FIREBASE_*_BASE64", error);
    return null;
  }
}

function readServiceAccountFromEnv(): ServiceAccountConfig {
  const base64Config = readServiceAccountFromBase64();
  if (base64Config?.projectId && base64Config?.clientEmail && base64Config?.privateKey) {
    return base64Config;
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT;

  const clientEmail =
    process.env.FIREBASE_CLIENT_EMAIL ||
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL ||
    base64Config?.clientEmail;

  const rawPrivateKey =
    process.env.FIREBASE_PRIVATE_KEY ||
    process.env.FIREBASE_ADMIN_PRIVATE_KEY ||
    base64Config?.privateKey;

  let privateKey = rawPrivateKey;
  if (typeof privateKey === "string" && privateKey.includes("\\n")) {
    privateKey = privateKey.replace(/\\n/g, "\n");
  }

  return { projectId: projectId ?? undefined, clientEmail, privateKey };
}

export function getAdminApp() {
  const { projectId, clientEmail, privateKey } = readServiceAccountFromEnv();

  if (!projectId || !clientEmail || !privateKey) return null;

  if (!adminApp) {
    const admin = require("firebase-admin");
    if (admin.apps?.length) {
      adminApp = admin.apps[0];
    } else {
      adminApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        projectId,
      });
    }
  }
  return adminApp;
}

export function getAdmin() {
  const app = getAdminApp();
  if (!app) {
    throw new Error("FIREBASE_ADMIN_NOT_CONFIGURED");
  }
  const admin = require("firebase-admin");
  const { getFirestore } = require("firebase-admin/firestore") as typeof import("firebase-admin/firestore");
  return {
    app,
    admin,
    db: getFirestore(app),
    auth: admin.auth(app),
  };
}
