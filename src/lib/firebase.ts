"use client";

import type { FirebaseApp } from "firebase/app";
import type { Auth } from "firebase/auth";

import { getFirebaseApp, getFirebaseAuth } from "./firebaseClient";

let firebaseApp: FirebaseApp | undefined;
let firebaseAuth: Auth | undefined;

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

export const auth: Auth = typeof window !== "undefined"
  ? getClientFirebaseAuth()
  : (undefined as unknown as Auth);
