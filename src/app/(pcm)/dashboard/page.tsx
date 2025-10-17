export const dynamic = "force-dynamic";
export const revalidate = 0;

import { listServicesPCM, listPackagesPCM } from "@/lib/data";
import Link from "next/link";

export default async function DashboardPCM() {
  const [services, packages] = await Promise.all([listServicesPCM(), listPackagesPCM()]);

  const abertos = services.filter((s) => s.status === "Aberto");
  const concluidos = services.filter((s) => s.status === "Concluído");
  const encerrados = services.filter((s) => s.status === "Encerrado");

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral de pacotes e serviços.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4">
          <p className="text-sm text-muted-foreground">Serviços (total)</p>
          <p className="text-2xl font-semibold">{services.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-muted-foreground">Abertos</p>
          <p className="text-2xl font-semibold">{abertos.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-muted-foreground">Concluídos</p>
          <p className="text-2xl font-semibold">{concluidos.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-muted-foreground">Encerrados</p>
          <p className="text-2xl font-semibold">{encerrados.length}</p>
        </div>
      </section>

      <section className="space-y-3">
        <h2>Pacotes</h2>
        {packages.length === 0 ? (
          <div className="card p-6 text-sm text-muted-foreground">Nenhum pacote cadastrado.</div>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {packages.map((p) => (
              <li key={p.id} className="card p-4">
                <h3 className="text-base font-medium">{p.nome ?? p.id}</h3>
                <p className="text-sm text-muted-foreground">{p.descricao ?? "—"}</p>
                <div className="mt-3">
                  <Link className="btn-secondary" href={`/pcm/pacotes/${p.id}`}>Abrir</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2>Serviços recentes</h2>
        {services.length === 0 ? (
          <div className="card p-6 text-sm text-muted-foreground">Nenhum serviço cadastrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="p-2">O.S</th>
                  <th className="p-2">Equipamento</th>
                  <th className="p-2">Setor</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Andamento</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {services.slice(0, 20).map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="p-2">{s.os ?? s.id}</td>
                    <td className="p-2">{s.equipamento ?? s.tag ?? "—"}</td>
                    <td className="p-2">{s.setor ?? "—"}</td>
                    <td className="p-2">{s.status}</td>
                    <td className="p-2">{Math.round(Number(s.andamento ?? 0))}%</td>
                    <td className="p-2 text-right">
                      <Link className="btn-outline" href={`/pcm/servicos/${s.id}`}>Abrir</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
