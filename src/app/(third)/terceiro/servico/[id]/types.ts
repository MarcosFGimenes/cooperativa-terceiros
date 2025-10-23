export type ThirdService = {
  id: string;
  os?: string | null;
  oc?: string | null;
  code?: string | null;
  tag?: string | null;
  equipmentName?: string | null;
  sector?: string | null;
  status?: string | null;
  plannedStart?: number | null;
  plannedEnd?: number | null;
  totalHours?: number | null;
  company?: string | null;
  andamento?: number | null;
  realPercent?: number | null;
  manualPercent?: number | null;
  updatedAt?: number | null;
  hasChecklist?: boolean;
};

export type ThirdServiceUpdate = {
  id: string;
  percent: number;
  description?: string;
  createdAt?: number | null;
};

export type ThirdChecklistItem = {
  id: string;
  description: string;
  weight: number;
  progress: number;
  status: "nao-iniciado" | "em-andamento" | "concluido";
  updatedAt?: number | null;
};
