export const dynamic = "force-dynamic";
export const revalidate = 0;

import ServiceDetailsClient from "@/components/ServiceDetailsClient";
import { fetchThirdService, fetchThirdServiceChecklist, fetchThirdServiceUpdates } from "@/lib/thirdServiceData";
import { getTokenCookie } from "@/lib/tokenSession";
import { getServicesForToken } from "@/lib/terceiroService";

export default async function TerceiroServicoPage({ params }: { params: { id: string } }) {
  const token = await getTokenCookie();
  if (!token) return null;

  const allowed = (await getServicesForToken(token)).some((service) => service.id === params.id);
  if (!allowed) {
    return <div className="card p-6">Acesso negado a este serviço.</div>;
  }

  const service = await fetchThirdService(params.id);
  if (!service) {
    return <div className="card p-6">Serviço não encontrado.</div>;
  }

  const [updates, checklist] = await Promise.all([
    fetchThirdServiceUpdates(params.id, 20).catch((error) => {
      console.error(`[terceiro/${params.id}] Falha ao carregar atualizações`, error);
      return [];
    }),
    fetchThirdServiceChecklist(params.id).catch((error) => {
      console.error(`[terceiro/${params.id}] Falha ao carregar checklist`, error);
      return [];
    }),
  ]);

  const hasChecklist = service.hasChecklist || checklist.length > 0;

  return (
    <ServiceDetailsClient service={{ ...service, hasChecklist }} updates={updates} checklist={checklist} />
  );
}
