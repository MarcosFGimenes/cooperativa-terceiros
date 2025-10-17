"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), pass);
      router.replace("/dashboard");
    } catch (error: any) {
      setErr(error?.message ?? "Falha no login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-lg rounded-2xl border bg-card p-6">
        <h1>Login (PCM/Terceiros)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acesse com suas credenciais. Se você recebeu um código, use <Link href="/acesso" className="link">Acesso por token</Link>.
        </p>

        <form onSubmit={onSubmit} className="mt-6 grid gap-3">
          <label className="grid gap-1">
            <span className="text-sm">E-mail</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="seu@email.com"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm">Senha</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              className="input"
              placeholder="••••••••"
            />
          </label>

          {err && <div className="text-sm text-red-500">{err}</div>}

          <button
            type="submit"
            className="btn-primary h-11 px-5"
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>

          <div className="mt-2 text-right">
            <Link href="/acesso" className="link">Acesso por token</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
