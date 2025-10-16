"use client";
import Link from "next/link";
import { useAuth } from "@/lib/auth/useAuth";
import { getAuth, signOut } from "firebase/auth";
import { app } from "@/lib/firebase";
import ThemeToggle from "@/components/ThemeToggle";

export default function HeaderClient() {
  const { user } = useAuth();

  async function doLogout() {
    const auth = getAuth(app);
    await signOut(auth);
    window.location.href = "/login";
  }

  return (
    <nav className="flex items-center gap-3 text-sm">
      <Link className="link" href="/login">
        Login
      </Link>
      <Link className="link" href="/acesso">
        Acesso por token
      </Link>
      {user ? (
        <>
          <Link className="link" href="/servicos">
            Dashboard
          </Link>
          <button
            type="button"
            onClick={doLogout}
            className="btn-ghost h-9 rounded-md px-3"
          >
            Sair
          </button>
        </>
      ) : null}
      <ThemeToggle />
    </nav>
  );
}
