"use client";
import Link from "next/link";
import { useAuth } from "@/lib/auth/useAuth";
import { signOut } from "firebase/auth";

import { tryGetAuth } from "@/lib/firebase";
import ThemeToggle from "@/components/ThemeToggle";

export default function HeaderClient() {
  const { user } = useAuth();

  async function doLogout() {
    try {
      await fetch("/api/pcm/session", { method: "DELETE" });
    } catch (error) {
      console.error("[header] Falha ao encerrar sessão PCM", error);
    }

    const { auth, error } = tryGetAuth();
    if (!auth) {
      console.error("[header] Autenticação indisponível", error);
      return;
    }
    await signOut(auth);
    window.location.href = "/login";
  }

  return (
    <nav className="flex items-center gap-2 text-sm text-muted-foreground">
      {user ? (
        <>
          <Link className="link-btn" href="/dashboard">
            Dashboard
          </Link>
          <button
            type="button"
            onClick={doLogout}
            className="btn btn-ghost"
          >
            Sair
          </button>
        </>
      ) : (
        <>
          <Link className="link-btn" href="/login">
            Login
          </Link>
          <Link className="link-btn" href="/acesso">
            Acesso por token
          </Link>
        </>
      )}
      <ThemeToggle />
    </nav>
  );
}
