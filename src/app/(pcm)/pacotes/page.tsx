"use client";
import RequireAuth from "@/components/RequireAuth";
import PageHeader from "@/components/PageHeader";
import Link from "next/link";
import { listPackages, type Package } from "@/lib/db";
import { useEffect, useState } from "react";

export default function PackagesListPage() {
  const [items, setItems] = useState<Package[]>([]);
  useEffect(() => { (async ()=> setItems(await listPackages()))(); }, []);
  return (
    <RequireAuth>
      <div className="container-page">
        <PageHeader
          title="Pacotes"
          subtitle="Agrupamento de serviços por empresa"
          actions={<Link className="btn-primary" href="/pacotes/novo">Novo pacote</Link>}
        />
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Nome</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {items.map(p => (
                <tr key={p.id}>
                  <td>{p.nome}</td>
                  <td>{p.status ?? "-"}</td>
                  <td><Link className="link" href={`/pacotes/${p.id}`}>Abrir</Link></td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={3} className="py-6 text-center text-muted-foreground">Nenhum pacote encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </RequireAuth>
  );
}
