"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import { signInWithCustomToken } from "firebase/auth";

export default function Page() {
  const router = useRouter();
  const sp = useSearchParams();
  const [msg, setMsg] = useState("Processando token…");

  useEffect(() => {
    const tokenId = sp.get("token");
    if (!tokenId) { setMsg("Token ausente na URL."); return; }

    (async () => {
      try {
        const res = await fetch("/api/claim-access", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tokenId }),
        });
        const data = await res.json();
        if (!res.ok) {
          // 👇 mostra a message vinda do server (em vez de só "internal")
          const detail = data?.message || data?.error || "Falha ao validar";
          throw new Error(detail);
        }

        const { customToken, targetType, targetId } = data;
        if (!customToken) throw new Error("Sem customToken.");

        await signInWithCustomToken(auth, customToken);
        if (targetType === "service") router.replace(`/s/${targetId}`);
        else if (targetType === "package") router.replace(`/p/${targetId}`);
        else router.replace("/");
      } catch (e: any) {
        setMsg(`Falha ao validar: ${e?.message || e}`);
      }
    })();
  }, [sp, router]);

  return <div className="p-6">{msg}</div>;
}
