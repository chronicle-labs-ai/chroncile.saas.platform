import type { EnvCardType } from "ui";
import type { EnvironmentRecord, EnvironmentType } from "@/frontend/shared/types";
import type { DbTemplateSummary, DetailTab } from "./types";

export const ENV_CARD_TYPE: Record<EnvironmentType, EnvCardType> = {
  PRODUCTION: "prod",
  STAGING: "stg",
  DEVELOPMENT: "dev",
  LOCAL: "local",
  EPHEMERAL: "ephemeral",
};

export const ENV_TYPE_LABELS: Record<EnvironmentRecord["type"], string> = {
  PRODUCTION: "prod",
  STAGING: "stg",
  DEVELOPMENT: "dev",
  LOCAL: "local",
  EPHEMERAL: "ephemeral",
};

export const SECRET_FIELDS = [
  {
    key: "AUTH_SECRET",
    label: "Auth Secret",
    placeholder: "Override or leave blank for default",
  },
  {
    key: "STRIPE_SECRET_KEY",
    label: "Stripe Secret Key",
    placeholder: "sk_test_...",
  },
];

export const TTL_OPTIONS = [
  { value: 4, label: "4 hours" },
  { value: 12, label: "12 hours" },
  { value: 24, label: "24 hours" },
  { value: 48, label: "48 hours" },
  { value: 168, label: "7 days" },
];

export const TEMPLATE_MODE_LABEL: Record<DbTemplateSummary["mode"], string> = {
  FLY_DB: "Fork",
  ENVIRONMENT: "Env",
  SEED_ONLY: "Seed",
};

export const BASE_DETAIL_TABS: { id: DetailTab; label: string }[] = [
  { id: "deployment", label: "Deployment" },
  { id: "users", label: "Users & Orgs" },
  { id: "resources", label: "Resources" },
  { id: "load-tests", label: "Load Tests" },
];

export const DATABASE_DETAIL_TAB: { id: DetailTab; label: string } = {
  id: "database",
  label: "Database",
};
