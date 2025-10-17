export const dynamic = "force-dynamic";
export const revalidate = 0;

import { tryGetAdminDb, getServerWebDb } from "@/lib/serverDb";
import { getTokenCookie } from "@/lib/tokenSession";
import { getServicesForToken } from "@/lib/terceiroService";

async function getServiceById(id: string) {
  const adminDb = tryGetAdminDb();
  if (adminDb) {
    const doc = await adminDb.collection("services").doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  } else {
    const webDb = await getServerWebDb();
    const { doc, getDoc } = await import("firebase/firestore");
    const dref = doc(webDb, "services", id);
    const ds = await getDoc(dref);
    return ds.exists() ? { id: ds.id, ...(ds.data() as any) } : null;
  }
}

export default async function TerceiroServicoPage({ params }: { params: { id: string } }) {
  const token = getTokenCookie();
  if (!token) return null;

  // Segurança básica: só deixa abrir se este serviço faz parte do escopo do token
  const allowed = (await getServicesForToken(token)).some((s) => s.id === params.id);
  if (!allowed) {
    return <div className="card p-6">Acesso negado a este serviço.</div>;
  }

  const serv = await getServiceById(params.id);
  if (!serv) return <div className="card p-6">Serviço não encontrado.</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Serviço {serv.os ?? serv.id}</h1>
      <div className="card p-4 space-y-2">
        <p><strong>Equipamento:</strong> {serv.equipamento ?? "—"}</p>
        <p><strong>Tag:</strong> {serv.tag ?? "—"}</p>
        <p><strong>Setor:</strong> {serv.setor ?? "—"}</p>
        <p><strong>Status:</strong> {serv.status ?? "—"}</p>
        <p><strong>Andamento:</strong> {Math.round(Number(serv.andamento ?? 0))}%</p>
      </div>
    </div>
  );
}
