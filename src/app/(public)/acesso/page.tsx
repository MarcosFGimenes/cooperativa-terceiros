"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import BackButton from "@/components/BackButton";
import { toast } from "sonner";

type ApiResponse =
  | { ok: true; redirectPath?: string; found?: boolean; demo?: boolean; note?: string }
  | { ok: false; error: string };

export default function AcessoPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const tokenFromUrl = sp.get("token") ?? "";
  const [token, setToken] = useState(tokenFromUrl);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setToken(tokenFromUrl); }, [tokenFromUrl]);

  async function validar() {
    if (!token) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/claim-access?token=${encodeURIComponent(token)}`, { cache: "no-store" });
      const json: ApiResponse = await res.json();
      setResult(json);
      if ("ok" in json && json.ok && json.redirectPath) {
        toast.success("Token válido. Redirecionando...");
        router.replace(json.redirectPath);
      } else if ("ok" in json && json.ok && !json.redirectPath) {
        toast.info("Token válido. Aguarde o redirecionamento pelo PCM ou utilize o link enviado.");
      } else if (!("ok" in json) || !json.ok) {
        toast.error("Token inválido ou expirado.");
      }
    } catch {
      toast.error("Falha ao validar token.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <BackButton />
      <div className="card p-6 mt-3">
        <h1 className="text-xl font-semibold">Acesso por Token</h1>
        <p className="text-sm text-muted-foreground mb-4">Informe o código recebido para acessar seu serviço ou pacote.</p>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="flex flex-col gap-1">
            <label className="label" htmlFor="token">Código do token</label>
            <input
              id="token"
              className="h-11 w-full rounded-lg border bg-background px-4 text-base text-foreground placeholder:text-muted-foreground"
              placeholder="EX: RFHX9T86"
              value={token}
              onChange={(e)=>setToken(e.target.value.trim())}
              aria-label="Código do token"
            />
          </div>
          <button
            type="button"
            onClick={validar}
            disabled={loading || !token}
            className="btn-primary h-11 text-base"
            aria-busy={loading}
          >
            {loading ? "Validando…" : "Validar token"}
          </button>
        </div>
        {result ? (
          <pre className="mt-4 overflow-auto rounded-md bg-secondary p-3 text-xs">{JSON.stringify(result, null, 2)}</pre>
        ) : null}
      </div>
    </div>
  );
}
