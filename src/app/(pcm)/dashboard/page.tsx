"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u ?? null));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (user === null) router.replace("/login");
  }, [user, router]);

  if (user === undefined) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="card p-6 text-sm text-muted-foreground">Carregando…</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1>Dashboard</h1>
      <p className="text-muted-foreground">Bem-vindo! (substitua com cards, listagens, etc.)</p>
    </div>
  );
}
