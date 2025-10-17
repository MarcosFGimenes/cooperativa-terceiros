"use client";
import Link from "next/link";
import { useAuth } from "@/lib/auth/useAuth";
import { getAuth, signOut } from "firebase/auth";
import { getClientFirebaseApp } from "@/lib/firebase";
import ThemeToggle from "@/components/ThemeToggle";

export default function HeaderClient() {
  const { user } = useAuth();

  async function doLogout() {
    const auth = getAuth(getClientFirebaseApp());
    await signOut(auth);
    window.location.href = "/login";
  }

  return (
    <nav className="flex items-center gap-2">
      <Link className="link-btn" href="/login">
        Login
      </Link>
      <Link className="link-btn" href="/acesso">
        Acesso por token
      </Link>
      {user ? (
        <>
          <Link className="link-btn" href="/(pcm)/dashboard">
            Dashboard
          </Link>
          <button
            type="button"
            onClick={doLogout}
            className="btn-ghost"
          >
            Sair
          </button>
        </>
      ) : null}
      <ThemeToggle />
    </nav>
  );
}
