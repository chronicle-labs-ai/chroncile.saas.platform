export type DetailTab =
  | "deployment"
  | "users"
  | "resources"
  | "load-tests"
  | "database";

export interface Branch {
  name: string;
  sha: string;
  isDefault: boolean;
}

export interface DbTemplateSummary {
  id: string;
  name: string;
  description: string | null;
  mode: "FLY_DB" | "ENVIRONMENT" | "SEED_ONLY";
}

export interface CreateEphemeralEnvironmentInput {
  branch: string;
  ttlHours: number;
  secrets: Record<string, string>;
  dbTemplateId: string | null;
}
