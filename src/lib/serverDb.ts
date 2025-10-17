// server-only
import "server-only";
import { getAdminApp } from "./firebaseAdmin";

// Admin (preferido)
export function tryGetAdminDb() {
  const app = getAdminApp();
  if (!app) return null;
  const { getFirestore } = require("firebase-admin/firestore");
  return getFirestore(app);
}

// Fallback: SDK Web rodando no servidor (usa NEXT_PUBLIC_*)
export async function getServerWebDb() {
  const { initializeApp, getApps } = await import("firebase/app");
  const { getFirestore } = await import("firebase/firestore");
  if (!getApps().length) {
    initializeApp({
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
    });
  }
  return getFirestore();
}
