"use client";

import type { FirebaseApp } from "firebase/app";

import { getFirebaseApp } from "./firebaseClient";

let firebaseApp: FirebaseApp | undefined;

export function getClientFirebaseApp(): FirebaseApp {
  if (!firebaseApp) {
    firebaseApp = getFirebaseApp();
  }
  return firebaseApp;
}
