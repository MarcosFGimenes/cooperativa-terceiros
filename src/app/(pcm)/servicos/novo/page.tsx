"use client";
import { useState } from "react";
import { db } from "@/lib/firebase";
import { addDoc, collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { customAlphabet } from "nanoid";

const nano = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 8);

export default function Page() {
  const [title, setTitle] = useState("");
  const [companyId, setCompanyId] = useState("lar");
  const [totalHours, setTotalHours] = useState<number>(40);
  const [desc, setDesc] = useState("");
  const [result, setResult] = useState<{ serviceId?: string; tokenId?: string; link?: string } | null>(null);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);

    // 1) cria serviço
    const srvRef = await addDoc(collection(db, "services"), {
      title,
      description: desc,
      companyId,
      status: "aberto",
      totalHoursPlanned: totalHours,
      startedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });

    // 2) cria token
    const tokenId = nano();
    await setDoc(doc(db, "accessTokens", tokenId), {
      targetType: "service",
      targetId: srvRef.id,
      companyId,
      oneTime: false,
      revoked: false,
      createdAt: serverTimestamp(),
    });

    const link = `${baseUrl}/acesso?token=${tokenId}`;
    setResult({ serviceId: srvRef.id, tokenId, link });
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Criar serviço</h1>
      <form onSubmit={onCreate} className="space-y-3 max-w-xl">
        <input className="border p-2 rounded w-full" placeholder="Título" value={title} onChange={e=>setTitle(e.target.value)} required />
        <input className="border p-2 rounded w-full" placeholder="Empresa (companyId)" value={companyId} onChange={e=>setCompanyId(e.target.value)} required />
        <input className="border p-2 rounded w-full" type="number" min={1} placeholder="Horas totais previstas" value={totalHours}
               onChange={e=>setTotalHours(Number(e.target.value))} required/>
        <textarea className="border p-2 rounded w-full" placeholder="Descrição" value={desc} onChange={e=>setDesc(e.target.value)} />
        <button className="px-4 py-2 rounded bg-black text-white">Criar</button>
      </form>

      {result && (
        <div className="mt-4 space-y-2">
          <div className="text-sm">Serviço criado: <b>{result.serviceId}</b></div>
          <div className="text-sm">Token: <b>{result.tokenId}</b></div>
          <div className="text-sm">
            Link de acesso para terceiros:{" "}
            <a className="text-blue-600 underline" href={result.link} target="_blank">{result.link}</a>
          </div>
          <div className="text-xs text-gray-500">Compartilhe esse link no WhatsApp/email. Enquanto o serviço estiver "aberto", eles poderão lançar updates.</div>
        </div>
      )}
    </div>
  );
}
