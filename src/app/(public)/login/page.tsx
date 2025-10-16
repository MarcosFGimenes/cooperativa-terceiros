"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { app } from "@/lib/firebase";

const AFTER_LOGIN = "/servicos";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);
    try {
      const auth = getAuth(app);
      await signInWithEmailAndPassword(auth, email, password);
      router.push(AFTER_LOGIN);
    } catch (error: unknown) {
      if (error instanceof Error) {
        setErrorMsg(error.message);
      } else {
        setErrorMsg("Falha ao entrar");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto max-w-lg px-4">
      <div className="mt-10 rounded-2xl border bg-card/60 p-6 backdrop-blur">
        <h1 className="mb-1">Login (PCM/Terceiros)</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Acesse com suas credenciais. Se você recebeu um código, use Acesso por token.
        </p>
        <form onSubmit={onSubmit} className="grid gap-3">
          <div className="grid gap-2">
            <label htmlFor="email" className="text-sm font-medium">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-md border bg-background px-3"
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="password" className="text-sm font-medium">
              Senha
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 rounded-md border bg-background px-3"
            />
          </div>
          {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
          <button
            type="submit"
            aria-busy={loading}
            disabled={loading}
            className="mt-2 h-11 rounded-md bg-primary px-4 text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
        <div className="mt-3 text-right">
          <Link className="link" href="/acesso">
            Acesso por token
          </Link>
        </div>
      </div>
    </div>
  );
}
