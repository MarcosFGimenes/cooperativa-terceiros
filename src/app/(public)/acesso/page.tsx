"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import { signInWithCustomToken } from "firebase/auth";

function AccessPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [msg, setMsg] = useState("Processando token…");
  const tokenId = searchParams.get("token");

  useEffect(() => {
    if (!tokenId) {
      setMsg("Token ausente na URL.");
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/claim-access", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tokenId }),
        });
        const data = await res.json();
        if (!res.ok) {
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
  }, [router, tokenId]);

  return <div className="p-6">{msg}</div>;
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Processando token…</div>}>
      <AccessPageContent />
    </Suspense>
  );
}
