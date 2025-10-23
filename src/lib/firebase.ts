import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

import { getFirebasePublicConfig } from "@/lib/firebaseConfig";

let clientApp: FirebaseApp | null = null;
let initError: Error | null = null;
let authInstance: Auth | null = null;
let firestoreInstance: Firestore | null = null;

function ensureClientApp() {
  if (typeof window === "undefined") {
    if (!initError) {
      initError = new Error("Firebase client is only available in the browser context");
      if (process.env.NODE_ENV !== "production") {
        console.warn("[firebase] Attempted to initialise Firebase client on the server");
      }
    }
    return;
  }

  if (clientApp || initError) return;

  try {
    const existing = getApps();
    clientApp = existing.length ? existing[0]! : initializeApp(getFirebasePublicConfig());
  } catch (error) {
    initError = error instanceof Error ? error : new Error(String(error));
    if (process.env.NODE_ENV !== "production") {
      console.error("[firebase] Failed to initialize Firebase client", initError);
    }
  }
}

export function tryGetClientApp(): { app: FirebaseApp | null; error: Error | null } {
  ensureClientApp();
  return { app: clientApp, error: initError };
}

export function getClientApp(): FirebaseApp {
  const { app, error } = tryGetClientApp();
  if (!app) {
    const fallbackError = error ?? new Error("Firebase client has not been initialised");
    if (process.env.NODE_ENV !== "production") {
      console.error("[firebase] Firebase app requested before being available", fallbackError);
    }
    throw fallbackError;
  }
  return app;
}

export const getClientFirebaseApp = getClientApp;

export function tryGetAuth(): { auth: Auth | null; error: Error | null } {
  const { app, error } = tryGetClientApp();
  if (!app) {
    return { auth: null, error };
  }

  if (!authInstance) {
    try {
      authInstance = getAuth(app);
    } catch (authError) {
      const errorObject =
        authError instanceof Error ? authError : new Error(String(authError));
      if (!initError) {
        initError = errorObject;
      }
      if (process.env.NODE_ENV !== "production") {
        console.error("[firebase] Failed to access Firebase Auth", errorObject);
      }
      return { auth: null, error: errorObject };
    }
  }

  return { auth: authInstance, error: null };
}

export function getAuthClient(): Auth {
  const { auth, error } = tryGetAuth();
  if (!auth) {
    const fallbackError = error ?? new Error("Firebase Auth is not available");
    if (process.env.NODE_ENV !== "production") {
      console.error("[firebase] Firebase Auth requested before being available", fallbackError);
    }
    throw fallbackError;
  }
  return auth;
}

export function tryGetFirestore(): { db: Firestore | null; error: Error | null } {
  const { app, error } = tryGetClientApp();
  if (!app) {
    return { db: null, error };
  }

  if (!firestoreInstance) {
    try {
      firestoreInstance = getFirestore(app);
    } catch (dbError) {
      const errorObject = dbError instanceof Error ? dbError : new Error(String(dbError));
      if (!initError) {
        initError = errorObject;
      }
      if (process.env.NODE_ENV !== "production") {
        console.error("[firebase] Failed to access Firestore", errorObject);
      }
      return { db: null, error: errorObject };
    }
  }

  return { db: firestoreInstance, error: null };
}

export function getFirestoreClient(): Firestore {
  const { db, error } = tryGetFirestore();
  if (!db) {
    const fallbackError = error ?? new Error("Firestore is not available");
    if (process.env.NODE_ENV !== "production") {
      console.error("[firebase] Firestore requested before being available", fallbackError);
    }
    throw fallbackError;
  }
  return db;
}
