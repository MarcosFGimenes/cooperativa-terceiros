"use client";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

export function AcessoClient() {
  const sp = useSearchParams();
  const token = sp.get("token") ?? "";
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function claim() {
    try {
      setLoading(true);
      const r = await fetch("/api/claim-access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token })
      });
      const json = await r.json();
      setResult(JSON.stringify(json, null, 2));
    } catch (e: any) {
      setResult(e?.message ?? "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-3">Acesso por Token</h1>
      <p className="mb-2 text-sm text-gray-600">Token detectado: <b>{token || "(vazio)"}</b></p>
      <button onClick={claim} disabled={!token || loading} className="rounded px-3 py-2 bg-black text-white disabled:opacity-50">
        {loading ? "Validando..." : "Validar token"}
      </button>
      {result && (
        <pre className="mt-4 p-3 bg-gray-100 rounded text-xs overflow-auto">{result}</pre>
      )}
    </main>
  );
}
