"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";

import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getFirebaseFirestore } from "@/lib/firebaseClient";

type ServiceRow = {
  id: string;
  os: string;
  tag: string;
  equipamento: string;
  status: string;
  empresaId: string;
  andamento: number;
};

type CompanyRow = {
  id: string;
  count: number;
};

type PackageData = {
  id: string;
  nome: string;
  descricao: string;
  status: string;
};

type Params = { params: { packageId: string } };

export default function PacoteDetalhePage({ params }: Params) {
  const { packageId } = params;
  const db = useMemo(() => getFirebaseFirestore(), []);
  const [loading, setLoading] = useState(true);
  const [packageData, setPackageData] = useState<PackageData | null>(null);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [issuingCompany, setIssuingCompany] = useState<string | null>(null);
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [issuedToken, setIssuedToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const pkgRef = doc(db, "packages", packageId);
        const snap = await getDoc(pkgRef);
        if (!snap.exists()) {
          toast.error("Pacote não encontrado.");
          return;
        }
        const data = snap.data() ?? {};
        if (cancelled) return;
        const pkg: PackageData = {
          id: snap.id,
          nome: String(data.nome ?? data.name ?? `Pacote ${snap.id}`),
          descricao: String(data.descricao ?? data.description ?? ""),
          status: String(data.status ?? "Aberto"),
        };
        setPackageData(pkg);

        const servicesRef = collection(db, "services");
        const [byPacote, byPackage] = await Promise.all([
          getDocs(query(servicesRef, where("pacoteId", "==", packageId))),
          getDocs(query(servicesRef, where("packageId", "==", packageId))),
        ]);
        const merged = new Map<string, ServiceRow>();
        [...byPacote.docs, ...byPackage.docs].forEach((docSnap) => {
          const serviceData = docSnap.data() ?? {};
          const row: ServiceRow = {
            id: docSnap.id,
            os: String(serviceData.os ?? ""),
            tag: String(serviceData.tag ?? ""),
            equipamento: String(serviceData.equipamento ?? serviceData.equipmentName ?? ""),
            status: String(serviceData.status ?? "Aberto"),
            empresaId: String(serviceData.empresaId ?? serviceData.company ?? ""),
            andamento: Number(serviceData.andamento ?? serviceData.realPercent ?? 0),
          };
          merged.set(docSnap.id, row);
        });
        const rows = Array.from(merged.values()).sort((a, b) => a.os.localeCompare(b.os));
        if (!cancelled) {
          setServices(rows);
          const grouped = new Map<string, number>();
          rows.forEach((row) => {
            const key = row.empresaId.trim();
            if (!key) return;
            grouped.set(key, (grouped.get(key) ?? 0) + 1);
          });
          setCompanies(Array.from(grouped.entries()).map(([id, count]) => ({ id, count })));
        }
      } catch (error) {
        console.error("[pacotes/:id] Falha ao carregar pacote", error);
        toast.error("Não foi possível carregar os dados do pacote.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [db, packageId]);

  async function issueTokenForCompany(companyId: string) {
    setIssuingCompany(companyId);
    try {
      const response = await fetch("/api/tokens/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: { type: "packageCompany", pacoteId: packageId, empresaId: companyId } }),
      });
      const json = await response.json();
      if (!response.ok || !json?.ok) {
        const message = json?.error ? String(json.error) : "Falha ao gerar token.";
        toast.error(message);
        return;
      }
      setIssuedToken(json.token);
      setTokenDialogOpen(true);
      toast.success("Token gerado com sucesso.");
    } catch (error) {
      console.error("[pacotes/:id] Falha ao gerar token", error);
      toast.error("Não foi possível gerar o token para a empresa.");
    } finally {
      setIssuingCompany(null);
    }
  }

  async function copyTokenLink() {
    if (!issuedToken) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/acesso?token=${issuedToken}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado para a área de transferência.");
    } catch {
      toast.error("Não foi possível copiar o link automaticamente.");
    }
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pacote #{packageId}</h1>
          <p className="text-sm text-muted-foreground">Gerencie o pacote, seus serviços e tokens de acesso por empresa.</p>
        </div>
        <Link className="btn-secondary" href="/pacotes">
          Voltar
        </Link>
      </div>

      {loading ? (
        <div className="rounded-2xl border bg-card/80 p-6 shadow-sm">
          <div className="h-6 w-2/3 animate-pulse rounded bg-muted/40" />
          <div className="mt-4 h-4 w-full animate-pulse rounded bg-muted/30" />
        </div>
      ) : packageData ? (
        <div className="space-y-6">
          <div className="rounded-2xl border bg-card/80 p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Informações do pacote</h2>
            <div className="mt-2 text-sm font-medium text-foreground">Nome: {packageData.nome}</div>
            <div className="mt-3 text-sm text-muted-foreground">Status atual: {packageData.status}</div>
            <p className="mt-3 text-sm text-muted-foreground">
              {packageData.descricao ? packageData.descricao : "Nenhuma descrição cadastrada."}
            </p>
          </div>

          <div className="rounded-2xl border bg-card/80 p-6 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-semibold">Empresas vinculadas</h2>
              <p className="text-sm text-muted-foreground">
                Gere tokens específicos por empresa para compartilhar com terceiros.
              </p>
            </div>
            {companies.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma empresa identificada nos serviços deste pacote.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[480px] text-sm">
                  <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Empresa</th>
                      <th className="px-4 py-3 font-semibold text-right">Serviços</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {companies.map((company) => (
                      <tr key={company.id} className="border-t">
                        <td className="px-4 py-3 font-medium">{company.id}</td>
                        <td className="px-4 py-3 text-right">{company.count}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={() => issueTokenForCompany(company.id)}
                            disabled={issuingCompany === company.id}
                            aria-busy={issuingCompany === company.id}
                          >
                            {issuingCompany === company.id ? "Gerando..." : "Gerar token"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-2xl border bg-card/80 p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Serviços deste pacote</h2>
            {services.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Nenhum serviço associado a este pacote.</p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-semibold">O.S</th>
                      <th className="px-4 py-3 font-semibold">Tag</th>
                      <th className="px-4 py-3 font-semibold">Equipamento</th>
                      <th className="px-4 py-3 font-semibold">Empresa</th>
                      <th className="px-4 py-3 font-semibold text-right">% Andamento</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {services.map((service) => (
                      <tr key={service.id} className="border-t">
                        <td className="px-4 py-3">{service.os || "—"}</td>
                        <td className="px-4 py-3">{service.tag || "—"}</td>
                        <td className="px-4 py-3">{service.equipamento || "—"}</td>
                        <td className="px-4 py-3">{service.empresaId || "—"}</td>
                        <td className="px-4 py-3 text-right">{Math.round(service.andamento)}%</td>
                        <td className="px-4 py-3 text-right">
                          <Link className="btn-ghost" href={`/servicos/${service.id}`}>
                            Abrir serviço
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border bg-card/80 p-6 shadow-sm text-sm text-muted-foreground">
          Pacote não encontrado.
        </div>
      )}

      <Dialog open={tokenDialogOpen} onOpenChange={setTokenDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Token gerado</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Compartilhe o token abaixo com a empresa selecionada. Ele dá acesso aos serviços deste pacote.
          </p>
          <div className="mt-4 rounded-lg border bg-muted/30 p-3 font-mono text-sm tracking-wide">{issuedToken}</div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={copyTokenLink}>
              Copiar link
            </button>
            <DialogClose className="btn-secondary">Fechar</DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
