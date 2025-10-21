import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getAuth } from "firebase-admin/auth";

import {
  clearPcmSessionCookie,
  getPcmSessionCookie,
} from "@/lib/auth/pcmSession";
import { getAdminApp } from "@/lib/firebaseAdmin";
import { isPCMUser } from "@/lib/pcmAuth";

export default async function PcmLayout({ children }: { children: ReactNode }) {
  const sessionCookie = getPcmSessionCookie();
  if (!sessionCookie) {
    redirect("/login");
  }

  const app = getAdminApp();
  if (!app) {
    clearPcmSessionCookie();
    redirect("/login");
  }

  try {
    const decoded = await getAuth(app).verifySessionCookie(sessionCookie, true);
    const email = decoded.email ?? "";
    if (!email || !isPCMUser(email)) {
      clearPcmSessionCookie();
      redirect("/login");
    }
  } catch (error) {
    console.error("[pcm-layout] Falha ao validar sessão", error);
    clearPcmSessionCookie();
    redirect("/login");
  }

  return <>{children}</>;
}
