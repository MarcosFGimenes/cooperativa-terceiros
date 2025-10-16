import Link from "next/link";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

export default async function ServiceDetail({ params }: Params) {
  const { id } = params;
  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1>Serviço #{id}</h1>
        <Link className="btn-secondary" href="/servicos">
          Voltar
        </Link>
      </div>
      <div className="grid gap-4">
        <div className="card p-4">
          <h2>Resumo</h2>
          <p className="text-sm text-muted-foreground">
            Detalhes do serviço e progresso aparecerão aqui.
          </p>
        </div>
        <div className="card p-4">
          <h2>Atualizações</h2>
          <p className="text-sm text-muted-foreground">
            Lista de updates do terceiro (em breve).
          </p>
        </div>
      </div>
    </div>
  );
}
