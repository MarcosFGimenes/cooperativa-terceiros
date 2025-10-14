"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import BackButton from "@/components/BackButton";

export default function LoginPage() {
  const [email, setEmail] = useState("pcm@gmail.com");
  const [password, setPassword] = useState("pcm123");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      // mantém a chamada existente de auth do projeto (window/firebase client)
      // @ts-expect-error global auth
      const { signInWithEmailAndPassword, auth } = window.__appAuth || {};
      if (!signInWithEmailAndPassword || !auth) throw new Error("Auth não inicializado");
      await signInWithEmailAndPassword(auth, email, password);
      toast.success("Login efetuado!");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Falha ao autenticar";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto grid min-h-[60dvh] max-w-md place-content-center gap-4">
      <BackButton className="justify-self-start -mt-8" />
      <div className="card p-6">
        <h1 className="mb-1 text-xl font-semibold tracking-tight">Login (PCM/Terceiros)</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Acesse com suas credenciais. Se você recebeu um código, use <Link className="link" href="/acesso">Acesso por token</Link>.
        </p>
        <form className="grid gap-3" onSubmit={onSubmit}>
          <label className="label" htmlFor="email">E-mail</label>
          <input id="email" className="input" value={email} onChange={(e)=>setEmail(e.target.value)} type="email" autoComplete="username" />
          <label className="label mt-2" htmlFor="password">Senha</label>
          <input id="password" className="input" value={password} onChange={(e)=>setPassword(e.target.value)} type="password" autoComplete="current-password" />
          <button className="btn-primary mt-3" disabled={loading} type="submit">
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>
        <div className="mt-4 text-right">
          <Link className="link text-sm" href="/acesso">Acesso por token</Link>
        </div>
      </div>
    </div>
  );
}
