import { resolveServicoRealPercent } from "./serviceProgress";
import type { Service } from "@/types";

type ServiceStatusLabel = "Aberto" | "Pendente" | "Concluído" | "Encerrado" | string;

export function normaliseServiceStatus(status: Service["status"] | string | null | undefined): ServiceStatusLabel {
  const raw = String(status ?? "").toLowerCase();
  if (raw === "concluido" || raw === "concluído") return "Concluído";
  if (raw === "encerrado") return "Encerrado";
  if (raw === "pendente") return "Pendente";
  return "Aberto";
}

export function resolveDisplayedServiceStatus(
  service: Service,
  options?: {
    realizedPercent?: number | null;
    referenceDate?: Parameters<typeof resolveServicoRealPercent>[1];
  },
): ServiceStatusLabel {
  const normalised = normaliseServiceStatus(service.status);
  const realizedPercent =
    typeof options?.realizedPercent === "number"
      ? options.realizedPercent
      : resolveServicoRealPercent(service, options?.referenceDate);

  if (Number.isFinite(realizedPercent) && realizedPercent >= 100) {
    return "Concluído";
  }

  return normalised;
}
