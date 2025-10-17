"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "@/lib/firebase";

type PcmGuardProps = {
  allowlist?: string;
  children: ReactNode;
};

type GuardState = "loading" | "unauthenticated" | "unauthorized" | "authorized";

function parseAllowlist(rawValue: string | undefined): string[] {
  if (!rawValue) return [];
  return rawValue
    .split(";")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export default function PcmGuard({ children, allowlist }: PcmGuardProps) {
  const normalizedAllowlist = useMemo(() => parseAllowlist(allowlist), [allowlist]);
  const [state, setState] = useState<GuardState>("loading");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setState("unauthenticated");
        return;
      }

      const email = user.email?.trim().toLowerCase();
      if (!email || !normalizedAllowlist.includes(email)) {
        setState("unauthorized");
        return;
      }

      setState("authorized");
    });

    return () => {
      unsubscribe();
    };
  }, [normalizedAllowlist]);

  if (state === "loading") {
    return <div className="p-6 text-sm text-gray-500">Carregando…</div>;
  }

  if (state === "unauthenticated") {
    return (
      <div className="p-6 text-sm text-gray-700">
        Acesso restrito. <Link href="/login" className="underline">Faça login</Link> para continuar.
      </div>
    );
  }

  if (state === "unauthorized") {
    return <div className="p-6 text-sm text-gray-700">Acesso restrito ao PCM.</div>;
  }

  return <>{children}</>;
}
