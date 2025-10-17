export type ServiceStatus = "aberto" | "concluido" | "encerrado";

export interface Service {
  id: string;
  os: string; // Ordem de Serviço
  oc?: string; // Ordem de Compra
  tag: string; // Tag do equipamento
  equipmentName: string;
  sector: string;
  plannedStart: string; // ISO date
  plannedEnd: string; // ISO date
  totalHours: number;
  plannedDaily?: number[];
  status: ServiceStatus;
  company?: string; // empresa executora
  createdAt?: number;
  updatedAt?: number;
  hasChecklist?: boolean;
  realPercent?: number; // calculado no servidor
  packageId?: string; // se pertencer a um pacote
}

export interface ChecklistItem {
  id: string;
  serviceId: string;
  description: string;
  weight: number; // 0..100 (soma = 100)
  progress: number; // 0..100
  status: "nao_iniciado" | "andamento" | "concluido";
  updatedAt?: number;
}

export interface ServiceUpdate {
  id: string;
  serviceId: string;
  token?: string; // para trilha de auditoria (terceiros)
  note?: string;
  manualPercent?: number; // usado só quando não há checklist
  realPercentSnapshot: number; // percent calculado no momento
  createdAt: number;
}

export interface Package {
  id: string;
  name: string;
  status: ServiceStatus;
  serviceIds: string[]; // serviços do pacote
  createdAt?: number;
}

export type AccessTokenTarget =
  | { targetType: "service"; targetId: string; company?: string }
  | { targetType: "package"; targetId: string; company?: string };

export type AccessToken = AccessTokenTarget & {
  id: string; // o próprio código do token (docId)
  active: boolean;
  expiresAt?: number | null;
  createdAt?: number;
};
