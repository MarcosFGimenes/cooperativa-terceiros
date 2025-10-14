import PageHeader from "@/components/PageHeader";
import BackButton from "@/components/BackButton";

export default function Page() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Serviços"
        description="Visualize e gerencie os serviços cadastrados pela equipe PCM."
        actions={<BackButton />}
      />
      <div className="card p-6 text-sm text-muted-foreground">
        Nenhuma listagem implementada ainda. Use o menu lateral para acessar outras funcionalidades.
      </div>
    </div>
  );
}
