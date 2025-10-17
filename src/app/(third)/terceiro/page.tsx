import { getTokenCookie } from "@/lib/tokenSession";
import { getServicesForToken, getTokenDoc } from "@/lib/terceiroService";
import Link from "next/link";

export default async function TerceiroHome() {
  const token = getTokenCookie();
  const tokenDoc = token ? await getTokenDoc(token) : null;
  const services = token ? await getServicesForToken(token) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Meus serviços</h1>
          <p className="text-sm text-muted-foreground">
            Token: <span className="font-mono">{token}</span>{" "}
            {tokenDoc?.empresa ? <span className="ml-2">• Empresa: <strong>{tokenDoc.empresa}</strong></span> : null}
          </p>
        </div>
      </div>

      {services.length === 0 ? (
        <div className="card p-6 text-sm text-muted-foreground">
          Nenhum serviço disponível com status <strong>Aberto</strong> para este token.
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <li key={s.id} className="card p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-medium">{s.os ?? "Sem O.S"}</h3>
                <span className="rounded-full border px-2 py-0.5 text-xs">{s.status ?? "-"}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {s.equipamento ?? s.tag ?? "—"} {s.setor ? `• ${s.setor}` : ""}
              </p>
              <div className="mt-3">
                <div className="h-2 w-full rounded bg-muted">
                  <div className="h-2 rounded bg-primary" style={{ width: `${Math.min(100, Number(s.andamento ?? 0))}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Andamento: {Math.round(Number(s.andamento ?? 0))}%</p>
              </div>
              <div className="mt-3 flex gap-2">
                <Link className="btn-primary" href={`/terceiro/servico/${s.id}`}>Abrir</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
