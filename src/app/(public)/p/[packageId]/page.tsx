export const dynamic = "force-dynamic";
export default function PackagePage({ params }: { params: { packageId: string }}) {
  return <main className="p-6">Pacote: <b>{params.packageId}</b> (placeholder)</main>;
}
