"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

type Props = {
  service: {
    id: string;
    os: string;
    company?: string;
  };
};

type TokenResponse = {
  token: string;
  link: string;
};

export default function ServiceRowActions({ service }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [token, setToken] = useState<TokenResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generateToken() {
    try {
      setIsLoading(true);
      setError(null);
      setToken(null);

      const response = await fetch("/api/admin/tokens/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "service",
          targetId: service.id,
          company: service.company,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as Partial<TokenResponse & { error?: string }>;
      if (!response.ok) {
        throw new Error(payload.error || "Não foi possível gerar o token");
      }

      if (!payload.token || !payload.link) {
        throw new Error("Resposta inesperada da API");
      }

      const link = payload.link.startsWith("http")
        ? payload.link
        : `${window.location.origin}${payload.link}`;

      setToken({ token: payload.token, link });
      toast.success("Token gerado com sucesso");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro inesperado";
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  function openPdf() {
    const url = `/(pcm)/servicos/${service.id}?tab=graph&export=pdf`;
    window.open(url, "_blank", "noopener");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Link href={`/(pcm)/servicos/${service.id}?tab=details`} className="btn-secondary text-xs">
          Editar
        </Link>
        <Link href={`/(pcm)/servicos/${service.id}?tab=updates`} className="btn-secondary text-xs">
          Abrir serviço
        </Link>
        <button type="button" onClick={generateToken} disabled={isLoading} className="btn-primary text-xs">
          {isLoading ? "Gerando…" : "Gerar token"}
        </button>
        <button type="button" onClick={openPdf} className="btn-secondary text-xs">
          Exportar PDF
        </button>
      </div>
      {token ? (
        <div className="rounded-md border border-primary/30 bg-primary/10 p-3 text-xs">
          <div className="font-semibold text-primary">Token: {token.token}</div>
          <div className="mt-1 truncate text-muted-foreground">
            Link: {" "}
            <a className="link" href={token.link} target="_blank" rel="noreferrer">
              {token.link}
            </a>
          </div>
        </div>
      ) : null}
      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}
    </div>
  );
}
