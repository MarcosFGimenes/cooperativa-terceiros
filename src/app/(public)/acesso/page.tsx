"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

type ApiResponse =
  | { ok: true; redirectPath?: string; found?: boolean; demo?: boolean; note?: string }
  | { ok: false; error: string };

export default function AcessoPorTokenPage() {
  const qp = useSearchParams();
  const router = useRouter();
  const initial = useMemo(() => (qp?.get("token") ?? "").trim(), [qp]);
  const [token, setToken] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);

  useEffect(() => setToken(initial), [initial]);

  async function onValidate(e?: FormEvent) {
    e?.preventDefault();
    if (!token) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/claim-access?token=${encodeURIComponent(token)}`, { cache: "no-store" });
      const json: ApiResponse = await res.json();
      setResult(json);
      if (json.ok && json.redirectPath) {
        toast.success("Token válido. Redirecionando...");
        router.replace(json.redirectPath);
      } else if (json.ok && !json.redirectPath) {
        toast.info("Token válido. Aguarde o redirecionamento pelo PCM ou utilize o link enviado.");
      } else {
        toast.error("Token inválido ou expirado.");
      }
    } catch {
      toast.error("Falha ao validar token.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto max-w-3xl px-4">
      {/* Back link */}
      <div className="pt-4">
        <a
          href="/login"
          className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:bg-muted"
        >
          ← Voltar
        </a>
      </div>

      {/* Card */}
      <div className="mt-4 rounded-2xl border bg-card/60 p-6 backdrop-blur">
        <h1 className="mb-1">Acesso por Token</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Informe o código recebido para acessar seu serviço ou pacote.
        </p>

        {/* Form: stacked on mobile, inline on ≥sm */}
        <form onSubmit={onValidate} className="grid items-end gap-3 sm:grid-cols-[1fr_auto]">
          <div className="space-y-2">
            <label htmlFor="token" className="text-sm font-medium">
              Código do token
            </label>
            <input
              id="token"
              name="token"
              aria-label="Código do token"
              value={token}
              onChange={(e) => setToken(e.target.value.toUpperCase())}
              placeholder="EX: RFHX9T86"
              className="w-full rounded-md border bg-background px-3 py-2 text-base leading-6 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              inputMode="text"
            />
          </div>

          <button
            type="submit"
            aria-busy={loading}
            disabled={loading || !token}
            className="h-10 rounded-md bg-primary px-4 text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-50 sm:ml-3"
          >
            {loading ? "Validando..." : "Validar token"}
          </button>
        </form>

        {/* Feedback */}
        {result && (
          <div className="mt-4 rounded-md border bg-muted/40 p-3">
            <pre className="overflow-x-auto text-xs leading-relaxed">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
