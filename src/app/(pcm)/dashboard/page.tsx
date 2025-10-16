export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <div className="container mx-auto px-4 py-6">
      <h1>Dashboard</h1>
      <p className="mt-2 text-muted-foreground">
        Bem-vindo! Use o menu para gerenciar serviços e pacotes.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <a href="/servicos" className="card block rounded-xl border p-4 hover:bg-muted">
          <h3 className="font-medium">Serviços</h3>
          <p className="text-sm text-muted-foreground">Cadastrar e acompanhar serviços</p>
        </a>
        <a href="/pacotes" className="card block rounded-xl border p-4 hover:bg-muted">
          <h3 className="font-medium">Pacotes</h3>
          <p className="text-sm text-muted-foreground">Agrupar e consolidar andamento</p>
        </a>
        <a href="/relatorios" className="card block rounded-xl border p-4 hover:bg-muted">
          <h3 className="font-medium">Relatórios</h3>
          <p className="text-sm text-muted-foreground">Exportar PDF / impressão</p>
        </a>
      </div>
    </div>
  );
}
