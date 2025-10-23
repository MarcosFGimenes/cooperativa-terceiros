"use client";

import { useEffect, useRef } from "react";
import { onIdTokenChanged } from "firebase/auth";

import { tryGetAuth } from "@/lib/firebase";

export default function PcmSessionSync() {
  const lastTokenRef = useRef<string | null>(null);

  useEffect(() => {
    const { auth } = tryGetAuth();
    if (!auth) {
      return () => {};
    }

    let abortController: AbortController | null = null;

    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      if (!user) {
        lastTokenRef.current = null;
        return;
      }

      try {
        const token = await user.getIdToken();
        if (!token || token === lastTokenRef.current) {
          return;
        }
        lastTokenRef.current = token;

        abortController?.abort();
        const controller = new AbortController();
        abortController = controller;

        const response = await fetch("/api/pcm/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
          signal: controller.signal,
        });

        if (!response.ok && response.status !== 403) {
          console.error("[pcm-session-sync] Falha ao atualizar cookie de sessão", {
            status: response.status,
          });
        }
      } catch (error) {
        if ((error as { name?: string }).name === "AbortError") {
          return;
        }
        console.error("[pcm-session-sync] Falha ao sincronizar sessão PCM", error);
      }
    });

    return () => {
      abortController?.abort();
      unsubscribe();
    };
  }, []);

  return null;
}
