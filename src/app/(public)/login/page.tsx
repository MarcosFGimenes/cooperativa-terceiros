"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { tryGetAuth } from "@/lib/firebase";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { auth: authInstance, error: authError } = useMemo(() => tryGetAuth(), []);

  useEffect(() => {
    if (authError) {
      console.error("[login] Falha ao carregar autenticação", authError);
      setErr("Configuração de login indisponível. Entre em contato com o suporte.");
    }
  }, [authError]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!authInstance) {
      setErr("A autenticação não está disponível no momento.");
      return;
    }
    setErr(null);
    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(authInstance, email.trim(), pass);
      const idToken = await credential.user.getIdToken();
      let sessionResp: Response;
      try {
        sessionResp = await fetch("/api/pcm/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: idToken }),
        });
      } catch (sessionError) {
        await signOut(authInstance);
        throw sessionError;
      }

      if (!sessionResp.ok) {
        const data = (await sessionResp.json().catch(() => null)) as { error?: string } | null;
        const code = data?.error;
        let message = "Não foi possível iniciar a sessão segura.";
        if (code === "not_allowed") {
          message = "Seu usuário não tem acesso ao dashboard PCM.";
        } else if (code === "admin_not_configured") {
          message = "Configuração de autenticação indisponível. Tente novamente mais tarde.";
        } else if (code === "invalid_token") {
          message = "Credenciais inválidas. Faça login novamente.";
        }

        await signOut(authInstance);
        setErr(message);
        return;
      }

      router.replace("/dashboard");
    } catch (error: unknown) {
      const message = error instanceof Error && error.message ? error.message : "Falha no login";
      setErr(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto flex min-h-[calc(100dvh-56px-48px)] items-center justify-center px-4 py-10">
      <div className="card w-full max-w-lg space-y-6 p-8 shadow-xl shadow-primary/10">
        <div className="flex items-center gap-3 text-sm text-primary">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/15 text-lg">🔐</span>
          <span className="font-semibold uppercase tracking-[0.2em] text-primary/80">Acesso seguro</span>
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Login (PCM/Terceiros)</h1>
          <p className="text-sm text-muted-foreground">
            Acesse com suas credenciais. Se você recebeu um código, use <Link href="/acesso" className="link">Acesso por token</Link>.
          </p>
        </div>

        <form onSubmit={onSubmit} className="grid gap-4">
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
            className="btn-primary h-11 px-5 shadow-md shadow-primary/20 transition-transform hover:-translate-y-[1px]"
            disabled={loading || !authInstance}
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
