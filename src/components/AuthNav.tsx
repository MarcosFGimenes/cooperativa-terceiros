"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function AuthNav() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  if (!user) {
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
      <button type="button" className="btn-outline h-9 px-3" onClick={() => signOut(auth)}>Sair</button>
    </nav>
  );
}
