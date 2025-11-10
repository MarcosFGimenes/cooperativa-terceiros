"use client";
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";

import { isFirebaseClientConfigError, tryGetAuth } from "@/lib/firebase";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const { auth, error } = tryGetAuth();
    if (!auth) {
      if (error) {
        const log = isFirebaseClientConfigError(error) ? console.warn : console.error;
        log("[useAuth] Autenticação indisponível", error);
      }
      setInitializing(false);
      setUser(null);
      return () => {};
    }
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setInitializing(false);
    });
    return () => unsub();
  }, []);

  return { user, initializing };
}
