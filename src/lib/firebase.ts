"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { initializeFirestore, setLogLevel, type Firestore } from "firebase/firestore";

import { getFirebasePublicConfig } from "@/lib/firebaseConfig";

type FirebaseClientGlobal = typeof globalThis & {
  __FIREBASE_CLIENT_APP__?: FirebaseApp;
  __FIREBASE_CLIENT_AUTH__?: Auth;
  __FIREBASE_CLIENT_DB__?: Firestore;
  __FIREBASE_CLIENT_ERROR__?: Error;
  __FIREBASE_CLIENT_FORCE_LONG_POLLING__?: boolean;
  __FIREBASE_CLIENT_USE_FETCH_STREAMS__?: boolean;
};

const globalForFirebase = globalThis as FirebaseClientGlobal;

function parseBooleanEnv(value: string | undefined | null): boolean | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return null;
}

const envForceLongPolling = parseBooleanEnv(process.env.NEXT_PUBLIC_FIRESTORE_FORCE_LONG_POLLING);
const envUseFetchStreams = parseBooleanEnv(process.env.NEXT_PUBLIC_FIRESTORE_USE_FETCH_STREAMS);

const forceLongPolling = envForceLongPolling ?? process.env.NODE_ENV === "production";
const useFetchStreams = forceLongPolling ? false : envUseFetchStreams ?? false;

if (!globalForFirebase.__FIREBASE_CLIENT_APP__ && !globalForFirebase.__FIREBASE_CLIENT_ERROR__) {
  try {
    const config = getFirebasePublicConfig();
    const app = getApps().length ? getApp() : initializeApp(config);

    if (process.env.NODE_ENV !== "production") {
      setLogLevel("debug");
      console.info(
        `[firebase] Firestore configurado com ${
          forceLongPolling ? "long-polling forçado" : "transporte padrão"
        } (useFetchStreams=${useFetchStreams ? "true" : "false"}).`,
      );
    }

    const db = initializeFirestore(app, {
      experimentalForceLongPolling: forceLongPolling,
      useFetchStreams,
    });

    const auth = getAuth(app);

    globalForFirebase.__FIREBASE_CLIENT_APP__ = app;
    globalForFirebase.__FIREBASE_CLIENT_DB__ = db;
    globalForFirebase.__FIREBASE_CLIENT_AUTH__ = auth;
    globalForFirebase.__FIREBASE_CLIENT_FORCE_LONG_POLLING__ = forceLongPolling;
    globalForFirebase.__FIREBASE_CLIENT_USE_FETCH_STREAMS__ = useFetchStreams;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    globalForFirebase.__FIREBASE_CLIENT_ERROR__ = err;
    if (process.env.NODE_ENV !== "production") {
      console.error("[firebase] Falha ao inicializar Firebase client", err);
    }
  }
}

const initializationError = globalForFirebase.__FIREBASE_CLIENT_ERROR__ ?? null;
const appCandidate = globalForFirebase.__FIREBASE_CLIENT_APP__ ?? null;
const firestoreCandidate = globalForFirebase.__FIREBASE_CLIENT_DB__ ?? null;
const authCandidate = globalForFirebase.__FIREBASE_CLIENT_AUTH__ ?? null;

const resolvedApp = appCandidate;
const resolvedDb = firestoreCandidate;
const resolvedAuth = authCandidate;

export const db = resolvedDb;
export const auth = resolvedAuth;
export default resolvedApp;

export const isFirestoreLongPollingForced =
  globalForFirebase.__FIREBASE_CLIENT_FORCE_LONG_POLLING__ ?? forceLongPolling;
export const isFirestoreFetchStreamsEnabled =
  globalForFirebase.__FIREBASE_CLIENT_USE_FETCH_STREAMS__ ?? useFetchStreams;

export function tryGetClientApp(): { app: FirebaseApp | null; error: Error | null } {
  return { app: resolvedApp, error: initializationError };
}

export function getClientApp(): FirebaseApp {
  if (initializationError) {
    throw initializationError;
  }
  if (!resolvedApp) {
    throw new Error("Firebase client não pôde ser inicializado.");
  }
  return resolvedApp;
}

export const getClientFirebaseApp = getClientApp;

export function tryGetAuth(): { auth: Auth | null; error: Error | null } {
  if (initializationError) {
    return { auth: null, error: initializationError };
  }
  return { auth: resolvedAuth, error: null };
}

export function getAuthClient(): Auth {
  if (initializationError) {
    throw initializationError;
  }
  if (!resolvedAuth) {
    throw new Error("Firebase auth não pôde ser inicializado.");
  }
  return resolvedAuth;
}

export function tryGetFirestore(): { db: Firestore | null; error: Error | null } {
  if (initializationError) {
    return { db: null, error: initializationError };
  }
  return { db: resolvedDb, error: null };
}

export function getFirestoreClient(): Firestore {
  if (initializationError) {
    throw initializationError;
  }
  if (!resolvedDb) {
    throw new Error("Firestore client não pôde ser inicializado.");
  }
  return resolvedDb;
}
