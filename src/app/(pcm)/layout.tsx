import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getAuth } from "firebase-admin/auth";

import {
  clearPcmSessionCookie,
  getPcmSessionCookie,
} from "@/lib/auth/pcmSession";
import PcmSessionSync from "@/components/PcmSessionSync";
import { getAdminApp } from "@/lib/firebaseAdmin";
import { verifyFirebaseIdToken } from "@/lib/firebaseIdentity";
import { isPCMUser } from "@/lib/pcmAuth";

export default async function PcmLayout({ children }: { children: ReactNode }) {
  const sessionCookie = getPcmSessionCookie();
  if (!sessionCookie) {
    redirect("/login");
  }

  const app = getAdminApp();
  if (app) {
    try {
      const decoded = await getAuth(app).verifySessionCookie(sessionCookie, true);
      const email = decoded.email ?? "";
      if (!email || !isPCMUser(email)) {
        clearPcmSessionCookie();
        redirect("/login");
      }

      return (
        <>
          <PcmSessionSync />
          {children}
        </>
      );
    } catch (error) {
      console.error("[pcm-layout] Falha ao validar sessão", error);
    }
  }

  const fallback = await verifyFirebaseIdToken(sessionCookie);
  if (!fallback) {
    clearPcmSessionCookie();
    redirect("/login");
  }

  const fallbackEmail = fallback.email ?? "";
  if (!fallbackEmail || !isPCMUser(fallbackEmail)) {
    clearPcmSessionCookie();
    redirect("/login");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(fallback.expiresAtSeconds) || fallback.expiresAtSeconds <= nowSeconds) {
    clearPcmSessionCookie();
    redirect("/login");
  }

  return (
    <>
      <PcmSessionSync />
      {children}
    </>
  );
}
