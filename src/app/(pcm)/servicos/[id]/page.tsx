import Link from "next/link";

import ServiceEditorClient from "./ServiceEditorClient";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

export default function ServiceDetailPage({ params }: Params) {
  const { id } = params;
  return (
    <div className="container mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Serviço #{id}</h1>
          <p className="text-sm text-muted-foreground">
            Consulte e edite os dados cadastrados, checklist e histórico de atualizações.
          </p>
        </div>
        <Link className="btn-secondary" href="/servicos">
          Voltar
        </Link>
      </div>

      <ServiceEditorClient serviceId={id} />
    </div>
  );
}
