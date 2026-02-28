import { prisma } from "@/lib/db";
import { getPermanentEnvs, type PermanentEnvConfig } from "@/lib/permanent-envs";
import * as fly from "@/lib/fly-client";
import * as vercel from "@/lib/vercel-client";

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
  let environment: string | null = null;

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
        environment = data.environment ?? null;
      }
    } catch {
      // health check failed but app exists
    }
  }

  let vercelUrl = config.vercelAlias;
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
  const existingNames = new Set(existing.map((e) => e.name));

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
      isHealthy: false,
      expiresAt: null,
    })),
    skipDuplicates: true,
  });
}
