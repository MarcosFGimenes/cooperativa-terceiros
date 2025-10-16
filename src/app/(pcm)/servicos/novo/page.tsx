import Link from "next/link";

export default function NovoServico() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1>Novo serviço</h1>
        <Link className="btn-secondary" href="/servicos">
          Cancelar
        </Link>
      </div>
      <div className="card p-4">
        <p className="text-sm text-muted-foreground">
          Formulário de criação (campos O.S, Tag, equipamento, datas, horas, checklist etc.). Integre aqui com os handlers
          já existentes quando oportuno.
        </p>
      </div>
    </div>
  );
}
