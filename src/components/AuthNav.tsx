"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";

import { tryGetAuth } from "@/lib/firebase";

export default function AuthNav() {
  const [user, setUser] = useState<User | null>(null);
  const { auth: authInstance, error: authError } = useMemo(() => tryGetAuth(), []);

  useEffect(() => {
    if (authError) {
      console.error("[auth-nav] Falha ao inicializar autenticação", authError);
    }
  }, [authError]);

  useEffect(() => {
    if (!authInstance) return;
    return onAuthStateChanged(authInstance, setUser);
  }, [authInstance]);

  if (!authInstance || !user) {
    return (
      <nav className="flex items-center gap-3 text-sm">
        <Link className="link" href="/login">Login</Link>
        <Link className="link" href="/acesso">Acesso por token</Link>
      </nav>
    );
  }
  return (
    <nav className="flex items-center gap-3 text-sm">
      <Link className="link" href="/dashboard">Dashboard</Link>
      <Link className="link" href="/servicos">Serviços</Link>
      <Link className="link" href="/pacotes">Pacotes</Link>
      <Link className="link" href="/relatorios">Relatórios</Link>
      <button type="button" className="btn btn-outline h-9 px-3" onClick={() => signOut(authInstance)}>Sair</button>
    </nav>
  );
}
