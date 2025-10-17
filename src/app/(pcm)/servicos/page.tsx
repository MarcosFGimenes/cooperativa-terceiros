"use client";
import RequireAuth from "@/components/RequireAuth";
import PageHeader from "@/components/PageHeader";
import Link from "next/link";
import { listServices, type Service } from "@/lib/db";
import { useEffect, useState } from "react";

export default function ServicesListPage() {
  const [items, setItems] = useState<Service[]>([]);
  useEffect(() => { (async ()=> setItems(await listServices()))(); }, []);
  return (
    <RequireAuth>
      <div className="container-page">
        <PageHeader
          title="Serviços"
          subtitle="Cadastros, status e andamento"
          actions={<Link className="btn-primary" href="/servicos/novo">Novo serviço</Link>}
        />
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>O.S</th><th>Equipamento</th><th>Setor</th><th>Status</th><th>Andamento</th><th></th></tr></thead>
            <tbody>
              {items.map(s => (
                <tr key={s.id}>
                  <td>{s.os}</td><td>{s.equipamento ?? "-"}</td><td>{s.setor ?? "-"}</td>
                  <td>{s.status ?? "-"}</td><td>{typeof s.andamento === "number" ? `${s.andamento}%` : "-"}</td>
                  <td><Link className="link" href={`/servicos/${s.id}`}>Abrir</Link></td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">Nenhum serviço encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </RequireAuth>
  );
}
