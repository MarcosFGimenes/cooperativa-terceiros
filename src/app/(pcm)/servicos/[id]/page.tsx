export const dynamic = "force-dynamic";
export const revalidate = 0;

import { notFound } from "next/navigation";

import ServiceDetailClient from "./ServiceDetailClient";
import {
  buildRealizedSeries,
  composeServiceRealtimeData,
  deriveRealizedPercent,
  toNewChecklist,
  toNewUpdates,
} from "./shared";
import { plannedCurve } from "@/lib/curve";
import { getLatestServiceToken } from "@/lib/repo/accessTokens";
import {
  getChecklist,
  getService,
  getServiceById,
  listUpdates,
} from "@/lib/repo/services";

export default async function ServiceDetailPage({ params }: { params: { id: string } }) {
  const [service, legacyService] = await Promise.all([
    getServiceById(params.id),
    getService(params.id),
  ]);

  const baseService = service ?? legacyService;
  if (!baseService) return notFound();

  const [rawChecklist, rawUpdates, latestToken] = await Promise.all([
    getChecklist(params.id).catch(() => []),
    listUpdates(params.id, 100).catch(() => []),
    getLatestServiceToken(baseService.id).catch((error) => {
      console.error(`[servicos/${baseService.id}] Falha ao carregar token mais recente`, error);
      return null;
    }),
  ]);

  const checklist = baseService.checklist?.length
    ? toNewChecklist(baseService.checklist)
    : toNewChecklist(rawChecklist);
  const updates = baseService.updates?.length
    ? toNewUpdates(baseService.updates)
    : toNewUpdates(rawUpdates);

  const totalHours = Number.isFinite(baseService.totalHours)
    ? Number(baseService.totalHours)
    : Number(legacyService?.totalHours ?? 0);

  const planned = plannedCurve(
    baseService.plannedStart || legacyService?.plannedStart || new Date().toISOString(),
    baseService.plannedEnd || legacyService?.plannedEnd || new Date().toISOString(),
    totalHours > 0 ? totalHours : 1,
  );

  const realizedPercent = deriveRealizedPercent(
    composeServiceRealtimeData(baseService, legacyService ?? undefined),
    checklist,
    updates,
  );

  const realizedSeries = buildRealizedSeries({
    updates,
    planned,
    realizedPercent,
    plannedStart: baseService.plannedStart || legacyService?.plannedStart,
    plannedEnd: baseService.plannedEnd || legacyService?.plannedEnd,
    createdAt: baseService.createdAt ?? legacyService?.createdAt,
  });

  const tokenLink = latestToken ? `/acesso?token=${latestToken.code}` : null;

  return (
    <ServiceDetailClient
      serviceId={baseService.id}
      baseService={composeServiceRealtimeData(baseService)}
      fallbackService={legacyService ? composeServiceRealtimeData(legacyService) : null}
      initialChecklist={checklist}
      initialUpdates={updates}
      initialPlanned={planned}
      initialRealizedSeries={realizedSeries}
      initialRealizedPercent={realizedPercent}
      latestToken={latestToken ? { code: latestToken.code, company: latestToken.company ?? null } : null}
      tokenLink={tokenLink}
    />
  );
}
