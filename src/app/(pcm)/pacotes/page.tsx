"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { collection, getDocs } from "firebase/firestore";

import { getFirebaseFirestore } from "@/lib/firebaseClient";

type PackageRow = {
  id: string;
  nome: string;
  descricao: string;
  status: string;
  serviceCount: number;
};

export default function PacotesPage() {
  const db = useMemo(() => getFirebaseFirestore(), []);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PackageRow[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const packagesSnap = await getDocs(collection(db, "packages"));
        const servicesSnap = await getDocs(collection(db, "services"));
        const serviceCount = new Map<string, number>();
        servicesSnap.forEach((docSnap) => {
          const data = docSnap.data() ?? {};
          const pacoteId = String(data.pacoteId ?? data.packageId ?? "").trim();
          if (!pacoteId) return;
          serviceCount.set(pacoteId, (serviceCount.get(pacoteId) ?? 0) + 1);
        });
        const packages: PackageRow[] = packagesSnap.docs.map((docSnap) => {
          const data = docSnap.data() ?? {};
          const nome = String(data.nome ?? data.name ?? "").trim();
          const descricao = String(data.descricao ?? data.description ?? "").trim();
          const status = String(data.status ?? "Aberto");
          return {
            id: docSnap.id,
            nome: nome || `Pacote ${docSnap.id}`,
            descricao,
            status,
            serviceCount: serviceCount.get(docSnap.id) ?? 0,
          };
        });
        setRows(packages);
      } catch (error) {
        console.error("[pacotes] Falha ao carregar pacotes", error);
        toast.error("Não foi possível carregar os pacotes.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [db]);

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pacotes</h1>
          <p className="text-sm text-muted-foreground">Organize serviços em pacotes e gere tokens por empresa executora.</p>
        </div>
        <Link className="btn-primary" href="/pacotes/novo">
          Novo pacote
        </Link>
      </div>

      <div className="overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Nome</th>
              <th className="px-4 py-3 font-semibold">Descrição</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold text-right">Serviços</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  Carregando pacotes...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  Nenhum pacote cadastrado.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-4 py-3 font-medium text-foreground">{row.nome}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.descricao || "—"}</td>
                  <td className="px-4 py-3">{row.status}</td>
                  <td className="px-4 py-3 text-right">{row.serviceCount}</td>
                  <td className="px-4 py-3 text-right">
                    <Link className="btn-ghost" href={`/pacotes/${row.id}`}>
                      Detalhes
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
