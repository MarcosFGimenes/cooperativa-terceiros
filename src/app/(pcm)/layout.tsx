import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getAuth } from "firebase-admin/auth";

import { getPcmSessionCookie } from "@/lib/auth/pcmSession";
import PcmSessionSync from "@/components/PcmSessionSync";
import { getAdminApp } from "@/lib/firebaseAdmin";
import { verifyFirebaseIdToken } from "@/lib/firebaseIdentity";
import { isPCMUser } from "@/lib/pcmAuth";

export default async function PcmLayout({ children }: { children: ReactNode }) {
  const sessionCookie = await getPcmSessionCookie();
  if (!sessionCookie) {
    redirect("/login");
  }

  const app = getAdminApp();
  if (app) {
    try {
      const decoded = await getAuth(app).verifySessionCookie(sessionCookie, true);
      const email = decoded.email ?? "";
      if (!email || !isPCMUser(email)) {
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
    redirect("/login");
  }

  const fallbackEmail = fallback.email ?? "";
  if (!fallbackEmail || !isPCMUser(fallbackEmail)) {
    redirect("/login");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(fallback.expiresAtSeconds) || fallback.expiresAtSeconds <= nowSeconds) {
    redirect("/login");
  }

  return (
    <>
      <PcmSessionSync />
      {children}
    </>
  );
}
