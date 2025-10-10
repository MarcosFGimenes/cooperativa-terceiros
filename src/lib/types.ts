export type ServiceStatus = "aberto" | "encerrado";

export interface ServiceDoc {
  id?: string;
  title: string;
  description?: string;
  companyId: string;
  packageId?: string | null;
  status: ServiceStatus;
  totalHoursPlanned: number;
  startedAt?: Date;
  expectedEndAt?: Date | null;
  closedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ServiceUpdate {
  id?: string;
  createdAt: Date;
  createdBy?: string; // uid ou "token"
  progress: number;   // cumulativo 0..100
  note?: string;
  hoursSpent?: number;
}

export interface PackageDoc {
  id?: string;
  name: string;
  description?: string;
  status: ServiceStatus; // pode espelhar "aberto"/"encerrado"
  serviceIds?: string[]; // opcional (a gente busca por where(packageId))
  companyIds?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}
