// server-only
import "server-only";
import { getFirestore } from "firebase-admin/firestore";

import { getFirebasePublicConfig } from "@/lib/firebaseConfig";
import { getAdminApp } from "./firebaseAdmin";

// Admin (preferido)
export function tryGetAdminDb() {
  const app = getAdminApp();
  if (!app) return null;
  return getFirestore(app);
}

// Fallback: SDK Web rodando no servidor (usa NEXT_PUBLIC_*)
export async function getServerWebDb() {
  const { initializeApp, getApps } = await import("firebase/app");
  const { getFirestore: getWebFirestore } = await import("firebase/firestore");
  if (!getApps().length) {
    initializeApp(getFirebasePublicConfig());
  }
  return getWebFirestore();
}
