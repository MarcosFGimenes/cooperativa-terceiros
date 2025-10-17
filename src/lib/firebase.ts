import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

let clientApp: FirebaseApp | undefined;
export function getClientApp() {
  if (!getApps().length) {
    clientApp = initializeApp({
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
    });
  } else if (!clientApp) {
    clientApp = getApps()[0]!;
  }
  return clientApp!;
}

export const getClientFirebaseApp = getClientApp;

const sharedApp = getClientApp();
export const app = sharedApp;
export const auth = getAuth(sharedApp);
export const db = getFirestore(sharedApp);
