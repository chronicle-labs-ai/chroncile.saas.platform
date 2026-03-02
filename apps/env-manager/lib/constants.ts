import type { EnvironmentType, EnvironmentStatus } from "@/lib/types";

export const TYPE_LABELS: Record<EnvironmentType, string> = {
  PRODUCTION: "PROD",
  STAGING: "STG",
  DEVELOPMENT: "DEV",
  LOCAL: "LOCAL",
  EPHEMERAL: "EPH",
};

export const BADGE_CLASS: Record<EnvironmentType, string> = {
  PRODUCTION: "badge--critical",
  STAGING: "badge--caution",
  DEVELOPMENT: "badge--data",
  LOCAL: "badge--nominal",
  EPHEMERAL: "badge--neutral",
};

export const STATUS_DOT_CLASS: Record<EnvironmentStatus, string> = {
  RUNNING: "status-dot--nominal",
  STOPPED: "status-dot--offline",
  PROVISIONING: "status-dot--caution status-dot--pulse",
  DESTROYING: "status-dot--critical status-dot--pulse",
  ERROR: "status-dot--critical",
};

export const fetcher = (url: string) => fetch(url).then((r) => r.json());
