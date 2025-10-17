// server-only
import "server-only";
import type { App } from "firebase-admin/app";

let adminApp: App | null = null;

export function getAdminApp() {
  // Só inicializa se todas as envs existirem
  const pid = process.env.FIREBASE_PROJECT_ID;
  const email = process.env.FIREBASE_CLIENT_EMAIL;
  let key = process.env.FIREBASE_PRIVATE_KEY;

  if (!pid || !email || !key) return null;

  // Corrige quebras de linha escapadas
  if (key?.includes("\\n")) key = key.replace(/\\n/g, "\n");

  if (!adminApp) {
    const admin = require("firebase-admin");
    if (admin.apps?.length) {
      adminApp = admin.apps[0];
    } else {
      adminApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: pid,
          clientEmail: email,
          privateKey: key!,
        }),
        projectId: pid,
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
