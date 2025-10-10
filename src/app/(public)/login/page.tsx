"use client";
import { useState } from "react";
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";

export default function Page() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [msg, setMsg] = useState("");

  async function doSignIn() {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      setMsg("Logado!");
    } catch (e: any) { setMsg(e.message); }
  }
  async function doSignUp() {
    try {
      await createUserWithEmailAndPassword(auth, email, pass);
      setMsg("Usuário criado e logado!");
    } catch (e: any) { setMsg(e.message); }
  }
  async function doSignOut() {
    await signOut(auth); setMsg("Saiu.");
  }

  return (
    <div className="p-6 space-y-3">
      <h1 className="text-xl font-semibold">Login</h1>
      <input className="border p-2 rounded w-80" placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} />
      <input className="border p-2 rounded w-80" placeholder="senha" type="password" value={pass} onChange={e=>setPass(e.target.value)} />
      <div className="space-x-2">
        <button onClick={doSignIn} className="px-3 py-2 bg-black text-white rounded">Entrar</button>
        <button onClick={doSignUp} className="px-3 py-2 border rounded">Criar conta</button>
        <button onClick={doSignOut} className="px-3 py-2 border rounded">Sair</button>
      </div>
      <div className="text-sm text-gray-600">{msg}</div>
    </div>
  );
}
