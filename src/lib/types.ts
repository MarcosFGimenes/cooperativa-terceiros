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
  timeWindow?: BaseServiceUpdate["timeWindow"];
  subactivity?: BaseServiceUpdate["subactivity"];
  mode?: BaseServiceUpdate["mode"];
  impediments?: BaseServiceUpdate["impediments"];
  resources?: BaseServiceUpdate["resources"];
  workforce?: BaseServiceUpdate["workforce"];
  shiftConditions?: BaseServiceUpdate["shiftConditions"];
  forecastDate?: number | null;
  criticality?: number | null;
  evidences?: BaseServiceUpdate["evidences"];
  justification?: string | null;
  previousPercent?: number | null;
  declarationAccepted?: boolean;
  audit?: BaseServiceUpdate["audit"];
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
