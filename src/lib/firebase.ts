"use client";

import type { FirebaseApp } from "firebase/app";
import type { Auth } from "firebase/auth";
import type { Firestore } from "firebase/firestore";

import { getFirebaseApp, getFirebaseAuth, getFirebaseFirestore } from "./firebaseClient";

let firebaseApp: FirebaseApp | undefined;
let firebaseAuth: Auth | undefined;
let firestoreDb: Firestore | undefined;

export function getClientFirebaseApp(): FirebaseApp {
  if (!firebaseApp) {
    firebaseApp = getFirebaseApp();
  }
  return firebaseApp;
}

export function getClientFirebaseAuth(): Auth {
  if (!firebaseAuth) {
    firebaseAuth = getFirebaseAuth();
  }
  return firebaseAuth;
}

export function getClientFirebaseFirestore(): Firestore {
  if (!firestoreDb) {
    firestoreDb = getFirebaseFirestore();
  }
  return firestoreDb;
}

export const auth: Auth = typeof window !== "undefined"
  ? getClientFirebaseAuth()
  : (undefined as unknown as Auth);

export const db: Firestore = typeof window !== "undefined"
  ? getClientFirebaseFirestore()
  : (undefined as unknown as Firestore);
