"use client";
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

import { getFirebasePublicConfig } from "@/lib/firebaseConfig";

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let firestore: Firestore | undefined;

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    if (typeof window === "undefined") {
      throw new Error("getFirebaseApp() called on server. Use only in client components.");
    }
    const config = getFirebasePublicConfig();
    app = getApps().length ? getApp() : initializeApp(config);
  }
  return app!;
}

export function getFirebaseAuth(): Auth {
  if (!auth) auth = getAuth(getFirebaseApp());
  return auth!;
}

export function getFirebaseFirestore(): Firestore {
  if (!firestore) firestore = getFirestore(getFirebaseApp());
  return firestore!;
}
