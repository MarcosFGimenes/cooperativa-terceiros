"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { toast } from "sonner";

import { getFirebaseAuth } from "@/lib/firebaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace("/dashboard");
      }
    });

    return () => unsubscribe();
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const auth = getFirebaseAuth();
      await signInWithEmailAndPassword(auth, email.trim(), password);
      toast.success("Login efetuado!");
      router.replace("/dashboard");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Falha ao autenticar";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto flex min-h-[80dvh] flex-col justify-center px-4">
      <div className="mx-auto w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Login (PCM/Terceiros)</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Acesse com suas credenciais. Se você recebeu um código, use {" "}
          <Link className="link" href="/acesso">
            Acesso por token
          </Link>
          .
        </p>
        <form onSubmit={onSubmit} className="mt-6 grid gap-4">
          <label className="grid gap-1">
            <span className="text-sm font-medium">E-mail</span>
            <input
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="off"
              placeholder="seu@email.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11 w-full rounded-lg border bg-background px-4 text-base text-foreground placeholder:text-muted-foreground"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium">Senha</span>
            <input
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 w-full rounded-lg border bg-background px-4 text-base text-foreground placeholder:text-muted-foreground"
            />
          </label>

          <button
            type="submit"
            aria-busy={loading}
            className="h-11 w-full rounded-lg bg-primary text-base text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>
        <div className="mt-4 text-right text-sm">
          <Link className="link" href="/acesso">
            Acesso por token
          </Link>
        </div>
      </div>
    </div>
  );
}
