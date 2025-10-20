import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

import { getFirebasePublicConfig } from "@/lib/firebaseConfig";

let clientApp: FirebaseApp | undefined;

export function getClientApp() {
  if (!getApps().length) {
    clientApp = initializeApp(getFirebasePublicConfig());
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
