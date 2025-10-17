"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, type Auth } from "firebase/auth";
import { toast } from "sonner";
import { getClientFirebaseApp } from "@/lib/firebase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [auth, setAuth] = useState<Auth | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const firebaseAuth = getAuth(getClientFirebaseApp());
    setAuth(firebaseAuth);
    const off = onAuthStateChanged(firebaseAuth, (u) => {
      setChecking(false);
      if (u) router.replace("/(pcm)/dashboard"); // only redirect if already authenticated
    });
    return () => off();
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!auth) {
      toast.error("Serviço de autenticação indisponível. Tente novamente.");
      return;
    }
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), pass);
      toast.success("Login efetuado");
      router.replace("/(pcm)/dashboard");
    } catch (err) {
      const error = err as { code?: string } | null;
      const msg = error?.code === "auth/invalid-credential"
        ? "Credenciais inválidas."
        : "Não foi possível entrar. Tente novamente.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <div className="container-page grid place-items-center">
        <div className="card p-6 text-sm text-muted-foreground">
          <span className="spinner mr-2" /> Verificando sessão…
        </div>
      </div>
    );
  }

  return (
    <div className="container-page max-w-md mx-auto">
      <div className="card p-6">
        <h1 className="mb-2">Entrar</h1>
        <p className="text-sm text-muted-foreground mb-4">
          Acesse com suas credenciais. Se você recebeu um código, use <a className="link" href="/acesso">Acesso por token</a>.
        </p>
        <form onSubmit={onSubmit} className="grid gap-3">
          <div className="grid gap-1.5">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
            />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="senha">Senha</label>
            <input
              id="senha"
              className="input"
              type="password"
              autoComplete="current-password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="Sua senha"
              required
            />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <button className="btn-primary" type="submit" disabled={submitting} aria-busy={submitting}>
              {submitting ? "Entrando…" : "Entrar"}
            </button>
            <a className="link-btn" href="/acesso">Acesso por token</a>
          </div>
        </form>
      </div>
    </div>
  );
}
