export const dynamic = "force-dynamic";
export default function ServicePage({ params }: { params: { serviceId: string }}) {
  return <main className="p-6">Serviço: <b>{params.serviceId}</b> (placeholder)</main>;
}
