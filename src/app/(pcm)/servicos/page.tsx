import Link from "next/link";

export const dynamic = "force-dynamic";

type Service = {
  id: string;
  os?: string;
  tag?: string;
  equipamento?: string;
  empresa?: string;
  status?: "Aberto" | "Concluído" | "Encerrado" | string;
  progresso?: number;
};

async function fetchServices(): Promise<Service[]> {
  try {
    // Se existir um repositório já pronto, use-o aqui.
    // return await getAllServicesForPCM();
    return [];
  } catch {
    return [];
  }
}

export default async function ServicosPage() {
  const services = await fetchServices();
  const total = services.length;
  const abertos = services.filter((s) => s.status === "Aberto").length;
  const concluidos = services.filter((s) => s.status === "Concluído").length;

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1>Serviços</h1>
        <div className="flex gap-2">
          <Link className="btn-secondary" href="/pacotes">
            Pacotes
          </Link>
          <Link className="btn-primary" href="/servicos/novo">
            Novo serviço
          </Link>
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <div className="text-sm text-muted-foreground">Total</div>
          <div className="text-2xl font-semibold">{total}</div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-muted-foreground">Abertos</div>
          <div className="text-2xl font-semibold">{abertos}</div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-muted-foreground">Concluídos</div>
          <div className="text-2xl font-semibold">{concluidos}</div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">O.S</th>
              <th className="px-3 py-2 text-left">Tag</th>
              <th className="px-3 py-2 text-left">Equipamento</th>
              <th className="px-3 py-2 text-left">Empresa</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">% Andamento</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {services.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  Nenhum serviço encontrado.
                </td>
              </tr>
            ) : (
              services.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-3 py-2">{s.os ?? "--"}</td>
                  <td className="px-3 py-2">{s.tag ?? "--"}</td>
                  <td className="px-3 py-2">{s.equipamento ?? "--"}</td>
                  <td className="px-3 py-2">{s.empresa ?? "--"}</td>
                  <td className="px-3 py-2">{s.status ?? "--"}</td>
                  <td className="px-3 py-2">
                    {typeof s.progresso === "number" ? `${s.progresso}%` : "--"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link className="btn-ghost" href={`/servicos/${s.id}`}>
                      Abrir
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
