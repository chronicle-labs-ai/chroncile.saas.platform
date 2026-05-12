import type { BadgeVariant } from "ui";
import type { DbTemplate } from "./types";

export const MODE_LABELS: Record<DbTemplate["mode"], string> = {
  FLY_DB: "Fly Postgres Fork",
  ENVIRONMENT: "Fork from Environment",
  SEED_ONLY: "Fresh DB + Seed SQL",
};

export const MODE_TONE: Record<DbTemplate["mode"], BadgeVariant> = {
  FLY_DB: "teal",
  ENVIRONMENT: "amber",
  SEED_ONLY: "green",
};

export const MODE_OPTIONS: {
  value: DbTemplate["mode"];
  label: string;
  description: string;
}[] = [
  {
    value: "FLY_DB",
    label: MODE_LABELS.FLY_DB,
    description: "Fork from an existing Fly Postgres app",
  },
  {
    value: "ENVIRONMENT",
    label: MODE_LABELS.ENVIRONMENT,
    description: "Fork from a running environment database",
  },
  {
    value: "SEED_ONLY",
    label: MODE_LABELS.SEED_ONLY,
    description: "Create a fresh empty DB and run seed SQL",
  },
];
