"use client";
import { useState } from "react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setMsg("Logado!");
    } catch (err: any) {
      setMsg(err.message ?? "Falha no login");
    }
  }

  async function onLogout() {
    await signOut(auth);
    setMsg("Saiu da sessão.");
  }

  return (
    <main className="max-w-sm mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Login (PCM/Terceiros)</h1>
      <form onSubmit={onLogin} className="flex flex-col gap-3">
        <input className="border rounded px-3 py-2" placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="border rounded px-3 py-2" placeholder="senha" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        <button className="rounded px-3 py-2 bg-black text-white">Entrar</button>
      </form>
      <button onClick={onLogout} className="mt-4 underline">Sair</button>
      {msg && <p className="mt-3 text-sm text-gray-600">{msg}</p>}
      <div className="mt-8">
        <a className="underline" href="/acesso?token=DEMO123">Acesso por token (exemplo)</a>
      </div>
    </main>
  );
}
