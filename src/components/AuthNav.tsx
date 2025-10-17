"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function AuthNav() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  return (
    <nav className="flex items-center gap-3 text-sm">
      {!user ? (
        <>
          <Link className="link" href="/login">
            Login
          </Link>
          <Link className="link" href="/acesso">
            Acesso por token
          </Link>
        </>
      ) : (
        <>
          <Link className="link" href="/dashboard">
            Dashboard
          </Link>
          <button
            type="button"
            className="btn-outline h-11 px-5"
            onClick={() => signOut(auth)}
            aria-label="Sair"
          >
            Sair
          </button>
        </>
      )}
    </nav>
  );
}
