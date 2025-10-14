"use client";

import { useState } from "react";
import Link from "next/link";

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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro inesperado";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  function openPdf() {
    const url = `/(pcm)/servicos/${service.id}?tab=graph&export=pdf`;
    window.open(url, "_blank", "noopener");
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/(pcm)/servicos/${service.id}?tab=details`}
          className="rounded border px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
        >
          Editar
        </Link>
        <Link
          href={`/(pcm)/servicos/${service.id}?tab=updates`}
          className="rounded border px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
        >
          Abrir serviço
        </Link>
        <button
          type="button"
          onClick={generateToken}
          disabled={isLoading}
          className="rounded border px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {isLoading ? "Gerando..." : "Gerar token"}
        </button>
        <button
          type="button"
          onClick={openPdf}
          className="rounded border px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
        >
          Exportar PDF
        </button>
      </div>
      {token && (
        <div className="space-y-1 rounded border bg-emerald-50 p-2 text-[0.75rem] text-emerald-700">
          <div>
            <span className="font-semibold">Token:</span> {token.token}
          </div>
          <div className="truncate">
            <span className="font-semibold">Link:</span>{" "}
            <a className="underline" href={token.link} target="_blank" rel="noreferrer">
              {token.link}
            </a>
          </div>
        </div>
      )}
      {error && <div className="rounded border border-amber-300 bg-amber-50 p-2 text-[0.75rem] text-amber-700">{error}</div>}
    </div>
  );
}
