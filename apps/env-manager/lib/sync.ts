import { prisma } from "@/lib/data";
import { fly, getPermanentEnvSecrets, vercel } from "@/lib/integrations";
import {
  getPermanentEnvs,
  type PermanentEnvConfig,
} from "./permanent-envs";

const FRONTEND_SYNC_KEYS = [
  "AUTH_SECRET",
  "AUTH_TRUST_HOST",
  "AUTH_URL",
  "ENCRYPTION_KEY",
  "EVENTS_MANAGER_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_BACKEND_URL",
  "NEXT_PUBLIC_POSTHOG_HOST",
  "NEXT_PUBLIC_POSTHOG_KEY",
  "NEXT_PUBLIC_SENTRY_DSN",
  "NEXT_PUBLIC_SENTRY_ORG",
  "NEXT_PUBLIC_SENTRY_PROJECT",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "SERVICE_SECRET",
  "STRIPE_SECRET_KEY",
] as const;

export async function syncPermanentEnvironments(): Promise<string[]> {
  const configs = getPermanentEnvs();
  const synced: string[] = [];

  for (const config of configs) {
    await syncOne(config);
    synced.push(config.name);
  }

  return synced;
}

async function syncOne(config: PermanentEnvConfig): Promise<void> {
  let flyStatus: "RUNNING" | "STOPPED" | "ERROR" = "STOPPED";
  let gitSha: string | null = null;
  let gitTag: string | null = null;
  let serviceSecret = config.serviceSecret;

  try {
    const app = await fly.getApp(config.flyAppName);
    if (app) {
      flyStatus = "RUNNING";
    }
  } catch {
    flyStatus = "ERROR";
  }

  if (flyStatus === "RUNNING") {
    try {
      const res = await fetch(`${config.flyAppUrl}/health`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        const data = await res.json();
        gitSha = data.gitSha ?? null;
        gitTag = data.gitTag ?? null;
      }
    } catch {
      // health check failed but app exists
    }
  }

  const [backendSecrets, frontendSecrets] = await Promise.all([
    getPermanentEnvSecrets(config, "backend", ["SERVICE_SECRET"]).catch(
      () => null
    ),
    getPermanentEnvSecrets(config, "frontend", [...FRONTEND_SYNC_KEYS]).catch(
      () => null
    ),
  ]);

  if (backendSecrets?.SERVICE_SECRET) {
    serviceSecret = backendSecrets.SERVICE_SECRET;
  }

  if (frontendSecrets && Object.keys(frontendSecrets).length > 0) {
    try {
      await vercel.upsertEnvVars(frontendSecrets, {
        target: config.vercelTarget,
        gitBranch: config.vercelGitBranch,
      });
    } catch {
      // Vercel credentials may be intentionally absent in local/admin-only setups.
    }
  }

  let vercelUrl = config.vercelAlias;
  if (frontendSecrets?.NEXT_PUBLIC_APP_URL) {
    vercelUrl = frontendSecrets.NEXT_PUBLIC_APP_URL;
  }
  if (!vercelUrl) {
    try {
      vercelUrl = await vercel.getLatestDeploymentUrl(config.gitBranch);
    } catch {
      // Vercel API not configured or branch has no deployments
    }
  }

  await prisma.environment.upsert({
    where: { name: config.name },
    update: {
      status: flyStatus,
      gitBranch: config.gitBranch,
      gitSha,
      gitTag,
      flyAppName: config.flyAppName,
      flyAppUrl: config.flyAppUrl,
      vercelUrl,
      ...(serviceSecret ? { serviceSecret } : {}),
      isHealthy: flyStatus === "RUNNING",
      lastHealthAt: flyStatus === "RUNNING" ? new Date() : undefined,
    },
    create: {
      name: config.name,
      type: config.type,
      status: flyStatus,
      gitBranch: config.gitBranch,
      gitSha,
      gitTag,
      flyAppName: config.flyAppName,
      flyAppUrl: config.flyAppUrl,
      vercelUrl,
      serviceSecret,
      isHealthy: flyStatus === "RUNNING",
      lastHealthAt: flyStatus === "RUNNING" ? new Date() : null,
      expiresAt: null,
    },
  });
}

export async function ensurePermanentEnvsExist(): Promise<void> {
  const configs = getPermanentEnvs();
  const names = configs.map((c) => c.name);

  const existing = await prisma.environment.findMany({
    where: { name: { in: names } },
    select: { name: true },
  });
  const existingNames = new Set(existing.map((e: { name: string }) => e.name));

  const missing = configs.filter((c) => !existingNames.has(c.name));
  if (missing.length === 0) return;

  await prisma.environment.createMany({
    data: missing.map((config) => ({
      name: config.name,
      type: config.type,
      status: "RUNNING" as const,
      gitBranch: config.gitBranch,
      flyAppName: config.flyAppName,
      flyAppUrl: config.flyAppUrl,
      vercelUrl: config.vercelAlias,
      serviceSecret: config.serviceSecret,
      isHealthy: false,
      expiresAt: null,
    })),
    skipDuplicates: true,
  });
}
