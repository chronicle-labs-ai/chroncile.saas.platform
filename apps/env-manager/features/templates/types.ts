export interface DbTemplate {
  id: string;
  name: string;
  description: string | null;
  mode: "FLY_DB" | "ENVIRONMENT" | "SEED_ONLY";
  flyDbName: string | null;
  sourceEnvId: string | null;
  seedSqlUrl: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface SeedFile {
  name: string;
  filename: string;
  description: string;
  url: string;
}

export interface CreateDbTemplateInput {
  name: string;
  description: string;
  mode: DbTemplate["mode"];
  flyDbName: string;
  sourceEnvId: string;
  seedSqlUrl: string;
}
