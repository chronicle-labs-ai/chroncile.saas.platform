import type { DbTemplate, SeedFile } from "./types";

export function templateSourceLabel(template: DbTemplate) {
  return template.flyDbName ?? template.sourceEnvId?.slice(0, 12) ?? "—";
}

export function templateSeedLabel(template: DbTemplate) {
  return template.seedSqlUrl ? "configured" : "—";
}

export function templateLastUsedLabel(template: DbTemplate) {
  return template.lastUsedAt
    ? new Date(template.lastUsedAt).toLocaleDateString()
    : "never";
}

export function seedOptionLabel(seed: SeedFile) {
  return `${seed.name} — ${seed.description}`;
}
