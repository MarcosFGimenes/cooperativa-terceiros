"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { createAccessToken } from "@/lib/accessTokens";

type Company = { companyId?: string; companyName?: string };

type Props = {
  packageId: string;
  companies?: Company[];
};

type GeneratedToken = {
  token: string;
  link: string;
  label: string;
};

function normaliseCompanies(companies: Company[] = []): Company[] {
  const seen = new Set<string>();
  const list: Company[] = [];
  for (const company of companies) {
    const id = (company.companyId ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    list.push({ companyId: id, companyName: company.companyName });
  }
  return list;
}

export default function PackageTokenManager({ packageId, companies }: Props) {
  const [customCompany, setCustomCompany] = useState("");
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [generated, setGenerated] = useState<GeneratedToken | null>(null);

  const availableCompanies = useMemo(() => normaliseCompanies(companies ?? []), [companies]);

  async function handleGenerate(companyId?: string, label?: string) {
    const scopeCompany = companyId?.trim() || undefined;
    const displayLabel = label || scopeCompany || "Todas as empresas";

    setIsGenerating(scopeCompany ?? "__all");
    try {
      const code = await createAccessToken({ packageId, empresa: scopeCompany });
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const link = `${origin}/acesso?token=${code}`;
      setGenerated({ token: code, link, label: displayLabel });
      toast.success(`Token gerado: ${code}`);
      if (!scopeCompany) {
        setCustomCompany("");
      }
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Não foi possível gerar o token para este pacote.";
      toast.error(message);
    } finally {
      setIsGenerating(null);
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Link copiado para a área de transferência");
    } catch (error) {
      console.error("[PackageTokenManager] Falha ao copiar", error);
      toast.error("Não foi possível copiar automaticamente.");
    }
  }

  return (
    <div className="card space-y-4 p-4">
      <div>
        <h2 className="text-lg font-semibold">Distribuir tokens para o pacote</h2>
        <p className="text-sm text-muted-foreground">
          Gere códigos únicos para compartilhar com as empresas executoras. O token
          garante acesso apenas aos serviços deste pacote.
        </p>
      </div>

      {availableCompanies.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Empresas vinculadas</h3>
          <ul className="space-y-2 text-sm">
            {availableCompanies.map((company) => {
              const id = company.companyId ?? "";
              const busy = isGenerating === id;
              return (
                <li
                  key={id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{company.companyName || id || "Empresa sem identificação"}</p>
                    {company.companyName ? (
                      <p className="text-xs text-muted-foreground">ID: {id}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary text-xs"
                    onClick={() => handleGenerate(id, company.companyName || id)}
                    disabled={busy}
                    aria-busy={busy}
                  >
                    {busy ? "Gerando..." : "Gerar token"}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">Token personalizado</h3>
        <p className="text-xs text-muted-foreground">
          Informe um identificador de empresa (opcional). Se deixar em branco, o token
          concederá acesso a todos os serviços do pacote.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={customCompany}
            onChange={(event) => setCustomCompany(event.target.value)}
            placeholder="ID da empresa (opcional)"
            className="input flex-1"
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => handleGenerate(customCompany.trim() || undefined, customCompany.trim() || undefined)}
            disabled={isGenerating !== null}
            aria-busy={isGenerating !== null && isGenerating !== "__all"}
          >
            {isGenerating !== null && (isGenerating === "__all" || isGenerating === customCompany.trim())
              ? "Gerando..."
              : "Gerar token"}
          </button>
        </div>
      </div>

      {generated ? (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Token gerado para</p>
          <p className="text-sm font-semibold text-primary">{generated.label}</p>
          <div className="mt-3 space-y-2">
            <div className="rounded-md border bg-background px-3 py-2 font-mono text-sm">
              {generated.token}
            </div>
            <button
              type="button"
              className="btn btn-secondary text-xs"
              onClick={() => copyToClipboard(generated.link)}
            >
              Copiar link de acesso
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
