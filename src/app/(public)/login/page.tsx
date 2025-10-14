"use client";

import { useEffect, useState } from "react";

import { signInWithEmailAndPassword, signOut } from "firebase/auth";

import { auth } from "@/lib/firebaseClient";

export const dynamic = "force-dynamic";

type ToastState = { type: "success" | "error"; message: string } | null;

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  async function onLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setToast({ type: "success", message: "Autenticação realizada com sucesso." });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Falha no login.";
      setToast({ type: "error", message });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onLogout() {
    try {
      await signOut(auth);
      setToast({ type: "success", message: "Sessão encerrada." });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Não foi possível encerrar a sessão.";
      setToast({ type: "error", message });
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 p-4 sm:p-6">
      <div aria-live="assertive" className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
        {toast && (
          <div
            role="alert"
            className={`pointer-events-auto inline-flex min-h-[44px] items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${
              toast.type === "error"
                ? "border border-red-200 bg-red-50 text-red-700"
                : "border border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {toast.message}
          </div>
        )}
      </div>

      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-gray-900">Login (PCM/Terceiros)</h1>
        <p className="text-sm text-gray-600">Informe suas credenciais para acessar a área restrita.</p>
      </header>

      <form onSubmit={onLogin} className="space-y-4 rounded-lg border bg-white p-6 shadow-sm">
        <div className="space-y-1 text-sm">
          <label className="font-medium text-gray-700" htmlFor="email">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            aria-label="E-mail"
            autoComplete="email"
            className="w-full rounded-lg border px-3 py-2 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="seunome@empresa.com"
            required
          />
        </div>
        <div className="space-y-1 text-sm">
          <label className="font-medium text-gray-700" htmlFor="password">
            Senha
          </label>
          <input
            id="password"
            type="password"
            aria-label="Senha"
            autoComplete="current-password"
            className="w-full rounded-lg border px-3 py-2 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Digite sua senha"
            required
          />
        </div>
        <div className="sticky bottom-0 -mx-6 -mb-6 border-t border-gray-200 bg-gradient-to-t from-white via-white/95 to-white px-6 py-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex w-full items-center justify-center rounded-lg bg-black px-4 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black disabled:cursor-not-allowed disabled:opacity-60 min-h-[44px] min-w-[44px]"
          >
            {isSubmitting ? "Entrando..." : "Entrar"}
          </button>
        </div>
      </form>

      <div className="flex flex-col gap-3 rounded-lg border bg-white p-6 text-sm shadow-sm">
        <button
          type="button"
          onClick={onLogout}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-gray-200 bg-gray-50 px-4 font-semibold text-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
        >
          Sair da sessão atual
        </button>
        <a
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-transparent bg-transparent px-4 font-semibold text-blue-700 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
          href="/acesso?token=DEMO123"
        >
          Acesso por token (exemplo)
        </a>
      </div>
    </main>
  );
}
