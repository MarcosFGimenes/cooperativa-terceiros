"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";

import RequireAuth from "@/components/RequireAuth";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { db } from "@/lib/firebase";
import { createAccessToken } from "@/lib/accessTokens";

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

type Params = { params: { id: string } };

export default function PacoteDetalhePage({ params }: Params) {
  const { id: packageId } = params;
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
          setCompanies(Array.from(grouped.entries()).map(([companyId, count]) => ({ id: companyId, count })));
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
  }, [packageId]);

  async function issueTokenForCompany(companyId: string) {
    setIssuingCompany(companyId);
    try {
      const token = await createAccessToken({ packageId, empresa: companyId });
      setIssuedToken(token);
      setTokenDialogOpen(true);
      toast.success(`Token gerado: ${token}`);
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
    <RequireAuth>
      <div className="container mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Pacote #{packageId}</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie o pacote, seus serviços e tokens de acesso por empresa.
            </p>
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
              {packageData.descricao ? (
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{packageData.descricao}</p>
              ) : null}
            </div>

            <div className="rounded-2xl border bg-card/80 p-6 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Serviços do pacote</h2>
                  <p className="text-sm text-muted-foreground">
                    {services.length} serviços vinculados a este pacote.
                  </p>
                </div>
                <Link className="btn-primary" href={`/pacotes/${packageId}/curva-s`}>
                  Ver Curva S consolidada
                </Link>
              </div>

              <div className="mt-4 overflow-hidden rounded-xl border">
                <table className="min-w-full divide-y divide-border text-left text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 font-medium uppercase tracking-wide text-muted-foreground">OS</th>
                      <th className="px-4 py-3 font-medium uppercase tracking-wide text-muted-foreground">Tag</th>
                      <th className="px-4 py-3 font-medium uppercase tracking-wide text-muted-foreground">Equipamento</th>
                      <th className="px-4 py-3 font-medium uppercase tracking-wide text-muted-foreground">Status</th>
                      <th className="px-4 py-3 font-medium uppercase tracking-wide text-muted-foreground">Andamento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {services.map((service) => (
                      <tr key={service.id}>
                        <td className="px-4 py-3 font-medium text-foreground">{service.os || "–"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{service.tag || "–"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{service.equipamento || "–"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{service.status}</td>
                        <td className="px-4 py-3 text-muted-foreground">{service.andamento}%</td>
                      </tr>
                    ))}
                    {!services.length ? (
                      <tr>
                        <td className="px-4 py-8 text-center text-muted-foreground" colSpan={5}>
                          Nenhum serviço encontrado para este pacote.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border bg-card/80 p-6 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Tokens de acesso por empresa</h2>
                  <p className="text-sm text-muted-foreground">
                    Gere ou copie tokens para que as empresas consultem o progresso dos serviços vinculados.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {companies.map((company) => (
                  <div key={company.id} className="rounded-xl border bg-background/60 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold">Empresa {company.id}</div>
                        <div className="text-xs text-muted-foreground">
                          {company.count} serviço(s) vinculado(s)
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={issuingCompany === company.id}
                        onClick={() => issueTokenForCompany(company.id)}
                      >
                        {issuingCompany === company.id ? "Gerando..." : "Gerar token"}
                      </button>
                    </div>
                  </div>
                ))}
                {!companies.length ? (
                  <div className="rounded-xl border border-dashed bg-background/60 p-4 text-sm text-muted-foreground">
                    Nenhuma empresa vinculada aos serviços deste pacote.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border bg-card/80 p-6 text-sm text-muted-foreground shadow-sm">
            Não foi possível encontrar o pacote solicitado.
          </div>
        )}

        <Dialog open={tokenDialogOpen} onOpenChange={setTokenDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Token gerado com sucesso</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4 text-sm">
              <p className="text-muted-foreground">
                Compartilhe o token abaixo com a empresa para que ela acompanhe os serviços deste pacote.
              </p>
              <div className="rounded-lg border bg-muted/50 p-3 font-mono text-sm">
                {issuedToken ?? "Nenhum token disponível"}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button type="button" className="btn-primary" onClick={copyTokenLink}>
                  Copiar link de acesso
                </button>
                <DialogClose asChild>
                  <button type="button" className="btn-secondary">
                    Fechar
                  </button>
                </DialogClose>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </RequireAuth>
  );
}
