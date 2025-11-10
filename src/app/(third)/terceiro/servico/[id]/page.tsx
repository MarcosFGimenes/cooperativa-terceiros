export const dynamic = "force-dynamic";
export const revalidate = 0;

import ServiceDetailsClient from "@/components/ServiceDetailsClient";
import { fetchThirdService, fetchThirdServiceChecklist, fetchThirdServiceUpdates } from "@/lib/thirdServiceData";
import { getTokenCookie } from "@/lib/tokenSession";
import { getServicesForToken } from "@/lib/terceiroService";
import { AdminDbUnavailableError } from "@/lib/serverDb";
import { mapFirestoreError } from "@/lib/utils/firestoreErrors";

export default async function TerceiroServicoPage({ params }: { params: { id: string } }) {
  const token = await getTokenCookie();
  if (!token) return null;

  try {
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
      <ServiceDetailsClient
        service={{ ...service, hasChecklist }}
        updates={updates}
        checklist={checklist}
        token={token}
      />
    );
  } catch (error) {
    if (error instanceof AdminDbUnavailableError || (error instanceof Error && error.message === "FIREBASE_ADMIN_NOT_CONFIGURED")) {
      console.error(`[terceiro/${params.id}] Firebase Admin não configurado`, error);
      return <div className="card p-6">Configuração de acesso ao banco indisponível.</div>;
    }

    const mapped = mapFirestoreError(error);
    if (mapped) {
      console.warn(`[terceiro/${params.id}] Falha ao acessar serviço`, error);
      const message = mapped.status === 404 ? "Serviço não encontrado." : mapped.message;
      return <div className="card p-6">{message}</div>;
    }

    console.error(`[terceiro/${params.id}] Erro inesperado`, error);
    return <div className="card p-6">Não foi possível carregar este serviço.</div>;
  }
}
