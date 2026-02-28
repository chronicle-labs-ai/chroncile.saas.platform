import type { EnvironmentType } from "@prisma/client";

export interface PermanentEnvConfig {
  name: string;
  type: EnvironmentType;
  gitBranch: string;
  flyAppName: string;
  flyAppUrl: string;
  vercelAlias: string | null;
}

export function getPermanentEnvs(): PermanentEnvConfig[] {
  const vercelProductionUrl = process.env.VERCEL_PRODUCTION_URL ?? null;
  const vercelStagingUrl = process.env.VERCEL_STAGING_URL ?? null;
  const vercelDevUrl = process.env.VERCEL_DEV_URL ?? null;

  return [
    {
      name: "production",
      type: "PRODUCTION",
      gitBranch: "main",
      flyAppName: "chronicle-backend",
      flyAppUrl: "https://chronicle-backend.fly.dev",
      vercelAlias: vercelProductionUrl,
    },
    {
      name: "staging",
      type: "STAGING",
      gitBranch: "staging",
      flyAppName: "chronicle-backend-staging",
      flyAppUrl: "https://chronicle-backend-staging.fly.dev",
      vercelAlias: vercelStagingUrl,
    },
    {
      name: "development",
      type: "DEVELOPMENT",
      gitBranch: "develop",
      flyAppName: "chronicle-backend-dev",
      flyAppUrl: "https://chronicle-backend-dev.fly.dev",
      vercelAlias: vercelDevUrl,
    },
  ];
}
