import type { EnvironmentType } from "./types";

export type PermanentEnvSlug = "dev" | "stg" | "prd";

export interface PermanentEnvConfig {
  name: string;
  type: EnvironmentType;
  gitBranch: string;
  flyAppName: string;
  flyAppUrl: string;
  vercelAlias: string | null;
  serviceSecret: string | null;
  dopplerEnv: PermanentEnvSlug;
  backendConfigEnvVar: string;
  backendTokenEnvVar: string;
  frontendConfigEnvVar: string;
  frontendTokenEnvVar: string;
  vercelTarget: "production" | "preview";
  vercelGitBranch?: string;
}

export function getPermanentEnvs(): PermanentEnvConfig[] {
  return [
    {
      name: "production",
      type: "PRODUCTION",
      gitBranch: "main",
      flyAppName: "chronicle-backend",
      flyAppUrl: "https://chronicle-backend.fly.dev",
      vercelAlias: process.env.VERCEL_PRODUCTION_URL ?? null,
      serviceSecret:
        process.env.SERVICE_SECRET_PRODUCTION ??
        process.env.SERVICE_SECRET ??
        null,
      dopplerEnv: "prd",
      backendConfigEnvVar: "DOPPLER_PRD_BACKEND_CONFIG",
      backendTokenEnvVar: "DOPPLER_PRD_BACKEND_TOKEN",
      frontendConfigEnvVar: "DOPPLER_PRD_FRONTEND_CONFIG",
      frontendTokenEnvVar: "DOPPLER_PRD_FRONTEND_TOKEN",
      vercelTarget: "production",
    },
    {
      name: "staging",
      type: "STAGING",
      gitBranch: "staging",
      flyAppName: "chronicle-backend-staging",
      flyAppUrl: "https://chronicle-backend-staging.fly.dev",
      vercelAlias: process.env.VERCEL_STAGING_URL ?? null,
      serviceSecret: process.env.SERVICE_SECRET_STAGING ?? null,
      dopplerEnv: "stg",
      backendConfigEnvVar: "DOPPLER_STG_BACKEND_CONFIG",
      backendTokenEnvVar: "DOPPLER_STG_BACKEND_TOKEN",
      frontendConfigEnvVar: "DOPPLER_STG_FRONTEND_CONFIG",
      frontendTokenEnvVar: "DOPPLER_STG_FRONTEND_TOKEN",
      vercelTarget: "preview",
      vercelGitBranch: "staging",
    },
    {
      name: "development",
      type: "DEVELOPMENT",
      gitBranch: "develop",
      flyAppName: "chronicle-backend-dev",
      flyAppUrl: "https://chronicle-backend-dev.fly.dev",
      vercelAlias: process.env.VERCEL_DEV_URL ?? null,
      serviceSecret: process.env.SERVICE_SECRET_DEV ?? null,
      dopplerEnv: "dev",
      backendConfigEnvVar: "DOPPLER_DEV_BACKEND_CONFIG",
      backendTokenEnvVar: "DOPPLER_DEV_BACKEND_TOKEN",
      frontendConfigEnvVar: "DOPPLER_DEV_FRONTEND_CONFIG",
      frontendTokenEnvVar: "DOPPLER_DEV_FRONTEND_TOKEN",
      vercelTarget: "preview",
      vercelGitBranch: "develop",
    },
  ];
}
