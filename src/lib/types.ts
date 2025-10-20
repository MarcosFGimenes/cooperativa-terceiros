import type {
  AccessToken as BaseAccessToken,
  AccessTokenTarget as BaseAccessTokenTarget,
  Package as BasePackage,
  Service as BaseService,
  ServiceChecklistItem as BaseChecklistItem,
  ServiceStatus as BaseServiceStatus,
  ServiceUpdate as BaseServiceUpdate,
} from "@/types";

export type ServiceStatus = BaseServiceStatus;

export type ChecklistItem = BaseChecklistItem & {
  serviceId?: string;
  updatedAt?: number;
};

export type ServiceUpdate = BaseServiceUpdate & {
  serviceId?: string;
  token?: string;
  manualPercent?: number;
  realPercentSnapshot?: number;
};

export type Service = BaseService & {
  plannedDaily?: number[];
  company?: string | null;
  realPercent?: number;
  hasChecklist?: boolean;
  packageId?: string;
  updatedAt?: number;
};

export type Package = BasePackage & {
  serviceIds?: string[];
};

export type AccessTokenTarget = BaseAccessTokenTarget;

export type AccessToken = BaseAccessToken;
