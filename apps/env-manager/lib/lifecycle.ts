import { prisma } from "@/lib/data";
import { fly, vercel } from "@/lib/integrations";
import * as github from "./github-client";

const FLY_REGION = "ams";
// Tag of the current production image. Update when a new version is deployed.
const BACKEND_IMAGE =
  "registry.fly.io/chronicle-backend:deployment-01KJKV4CE2AG4XE7GFHCFZGHJ0";
// chronicle-backend- prefix = 18 chars, suffix = 5 chars (-xxxx), Fly max = 30 → base slug max = 7
const MAX_SLUG_BASE_LEN = 7;

export function sanitizeBranchSlug(branch: string): string {
  return branch
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-/, "")
    .replace(/-$/, "")
    .slice(0, MAX_SLUG_BASE_LEN)
    .replace(/-$/, "");
}

/** Generate a 4-char alphanumeric suffix for uniqueness, e.g. "a3f2" */
export function generateSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}

/** Full unique name: base-slug + "-" + suffix, e.g. "test-ep-a3f2" */
export function buildEnvName(branch: string, suffix: string): string {
  const base = sanitizeBranchSlug(branch);
  return `${base}-${suffix}`;
}

export interface ProvisionOptions {
  name: string;
  branch: string;
  ttlHours: number;
  secrets: Record<string, string>;
  dbTemplateId?: string | null;
}

export async function provisionEphemeral(
  opts: ProvisionOptions
): Promise<string> {
  const env = await prisma.environment.findUnique({
    where: { name: opts.name },
  });
  if (!env) throw new Error(`Environment record for "${opts.name}" not found`);

  const slug = env.name;
  const flyAppName = env.flyAppName ?? `chronicle-backend-${slug}`;
  const flyDbName = env.flyDbName ?? `chronicle-db-${slug}`;
  const flyAppUrl = `https://${flyAppName}.fly.dev`;

  const logLines: string[] = [];

  // ── Rollback tracker ────────────────────────────────────────────────────────
  // Every resource created is registered here. On failure, all are torn down.
  const created = {
    flyApp: false,
    flyDb: false,
    vercelEnvVarId: null as string | null,
  };

  async function log(
    message: string,
    level: "info" | "warn" | "error" = "info"
  ) {
    const line = `[${new Date().toISOString()}] ${level.toUpperCase()}: ${message}`;
    logLines.push(line);
    await prisma.environment
      .update({
        where: { id: env!.id },
        data: { provisionLog: logLines.join("\n") },
      })
      .catch(() => {}); // don't throw on DB errors during logging
  }

  async function rollback(reason: string): Promise<void> {
    await log(`ROLLBACK: ${reason}`, "error");
    await log("Rolling back all provisioned resources...", "error");

    if (created.vercelEnvVarId) {
      try {
        await vercel.deleteEnvVar(created.vercelEnvVarId);
        await log("Rollback: Vercel env var deleted");
      } catch (e) {
        await log(`Rollback: Failed to delete Vercel env var — ${e}`, "warn");
      }
    }

    if (created.flyApp) {
      try {
        const machines = await fly.listMachines(flyAppName);
        for (const m of machines) {
          await fly.destroyMachine(flyAppName, m.id);
        }
        await fly.deleteApp(flyAppName);
        await log(`Rollback: Fly app ${flyAppName} destroyed`);
      } catch (e) {
        await log(`Rollback: Failed to destroy Fly app — ${e}`, "warn");
      }
    }

    if (created.flyDb) {
      try {
        await fly.deletePostgresCluster(flyDbName);
        await log(`Rollback: Fly Postgres ${flyDbName} destroyed`);
      } catch (e) {
        await log(`Rollback: Failed to destroy Fly Postgres — ${e}`, "warn");
      }
    }

    await log("Rollback complete");
  }

  // ── Helper: fail with full rollback ─────────────────────────────────────────
  async function failWith(error: unknown): Promise<never> {
    const message = error instanceof Error ? error.message : String(error);
    await rollback(message);
    await prisma.environment.update({
      where: { id: env!.id },
      data: {
        status: "ERROR",
        errorLog: logLines.join("\n"),
        provisionLog: logLines.join("\n"),
      },
    });
    throw error instanceof Error ? error : new Error(message);
  }

  // ── Provision ───────────────────────────────────────────────────────────────
  await log("Starting provisioning...");
  await log(`Branch: ${opts.branch} | Name: ${slug}`);
  await log(`Fly app: ${flyAppName} | Fly DB: ${flyDbName}`);

  let branchSha = "";
  try {
    await log("Fetching branch info from GitHub...");
    const branchInfo = await github.getBranchInfo(opts.branch);
    branchSha = branchInfo.sha;
    await prisma.environment.update({
      where: { id: env.id },
      data: { gitSha: branchSha },
    });
    await log(`Branch SHA: ${branchSha.slice(0, 7)}`);
  } catch (err) {
    await failWith(
      new Error(
        `GitHub branch lookup failed: ${err instanceof Error ? err.message : String(err)}`
      )
    );
  }

  // 1. Postgres cluster — fork from template or create fresh
  let pgConnStr = "";
  let dbTemplate: {
    id: string;
    name: string;
    flyDbName: string | null;
    sourceEnvId: string | null;
    seedSqlUrl: string | null;
    mode: string;
  } | null = null;

  if (opts.dbTemplateId) {
    dbTemplate = await prisma.dbTemplate.findUnique({
      where: { id: opts.dbTemplateId },
    });
    if (dbTemplate) {
      await prisma.environment.update({
        where: { id: env.id },
        data: { dbTemplateId: dbTemplate.id },
      });
    }
  }

  try {
    const existing = await fly.getApp(flyDbName);
    if (existing) {
      await log(`Postgres cluster already exists: ${flyDbName} — reusing`);
      created.flyDb = true;
    } else if (
      dbTemplate &&
      (dbTemplate.mode === "FLY_DB" || dbTemplate.mode === "ENVIRONMENT")
    ) {
      // Fork from template
      let sourceDbName = dbTemplate.flyDbName;
      if (dbTemplate.mode === "ENVIRONMENT" && dbTemplate.sourceEnvId) {
        const srcEnv = await prisma.environment.findUnique({
          where: { id: dbTemplate.sourceEnvId },
        });
        sourceDbName = srcEnv?.flyDbName ?? null;
      }
      if (!sourceDbName) {
        await failWith(
          new Error(
            `Template "${dbTemplate.name}" has no source DB to fork from`
          )
        );
      }
      await log(
        `Forking Postgres from ${sourceDbName} → ${flyDbName} (template: ${dbTemplate.name})...`
      );
      const pgResult = await fly.forkPostgresCluster(
        sourceDbName!,
        flyDbName,
        FLY_REGION
      );
      pgConnStr = pgResult.connectionString;
      created.flyDb = true;
      await log(`Postgres forked from ${sourceDbName}`);
      await prisma.dbTemplate.update({
        where: { id: dbTemplate.id },
        data: { lastUsedAt: new Date() },
      });
    } else {
      // Fresh empty DB
      await log(`Creating Fly Postgres cluster: ${flyDbName}...`);
      const pgResult = await fly.createPostgresCluster(flyDbName, FLY_REGION);
      pgConnStr = pgResult.connectionString;
      created.flyDb = true;
      await log(`Postgres cluster created: ${flyDbName}`);
    }
  } catch (err) {
    if ((err as Error).message.includes("ROLLBACK")) throw err;
    await failWith(
      new Error(
        `Postgres setup failed: ${err instanceof Error ? err.message : String(err)}`
      )
    );
  }

  // 2. Fly app
  try {
    const existingApp = await fly.getApp(flyAppName);
    if (existingApp) {
      await log(
        `Fly app already exists: ${flyAppName} (${existingApp.status}) — reusing`
      );
      created.flyApp = true;
    } else {
      await log(`Creating Fly app: ${flyAppName}...`);
      await fly.createApp(flyAppName);
      created.flyApp = true;
      await log("Fly app created");
    }
  } catch (err) {
    await failWith(err);
  }

  // 3. Attach Postgres → get DATABASE_URL
  if (!pgConnStr) {
    try {
      await log(`Attaching Postgres ${flyDbName} → ${flyAppName}...`);
      const { stdout } = await fly.attachPostgres(flyDbName, flyAppName);
      const connMatch = stdout.match(/DATABASE_URL=(\S+)/);
      if (connMatch) {
        pgConnStr = connMatch[1];
        await log("Postgres attached, DATABASE_URL extracted");
      } else {
        await failWith(
          new Error(
            "Postgres attached but DATABASE_URL could not be extracted from output"
          )
        );
      }
    } catch (err) {
      if ((err as Error).message.includes("DATABASE_URL")) throw err; // already failWith'd
      await failWith(
        new Error(
          `Postgres attach failed: ${err instanceof Error ? err.message : String(err)}`
        )
      );
    }
  }

  // 4. Allocate public IPs
  try {
    await log("Allocating public IPs...");
    await fly.allocatePublicIps(flyAppName);
    await log("IPs allocated");
  } catch (err) {
    await failWith(err);
  }

  // 5. Create machine — generate a unique SERVICE_SECRET for this env
  const ephemeralServiceSecret = `ephemeral-${slug}-svc-${generateSuffix()}${generateSuffix()}`;
  try {
    await log(`Creating machine in ${FLY_REGION}...`);
    const machineEnv: Record<string, string> = {
      BACKEND_MODE: "real",
      ENVIRONMENT: "ephemeral",
      GIT_SHA: branchSha,
      DATABASE_URL: pgConnStr,
      SERVICE_SECRET: ephemeralServiceSecret,
      AUTH_SECRET:
        opts.secrets.AUTH_SECRET ??
        `ephemeral-auth-${generateSuffix()}-change-in-prod`,
      ...opts.secrets,
    };
    await fly.createMachine(flyAppName, {
      region: FLY_REGION,
      image: BACKEND_IMAGE,
      env: machineEnv,
    });
    await log("Machine created, waiting for healthy...");
  } catch (err) {
    await failWith(err);
  }

  // 6. Health check
  const healthy = await fly.waitForHealthy(flyAppUrl, 120_000, 5_000);
  if (!healthy) {
    await failWith(
      new Error(
        `Backend at ${flyAppUrl} did not become healthy within 120s — check machine logs`
      )
    );
  }
  await log("Backend is healthy");

  // 6.5. Run seed SQL now that the backend has applied migrations
  if (dbTemplate?.seedSqlUrl) {
    try {
      await log(`Running seed SQL from ${dbTemplate.seedSqlUrl}...`);
      await fly.runSeedSql(flyDbName, dbTemplate.seedSqlUrl);
      await log("Seed SQL executed successfully");
    } catch (err) {
      await log(
        `Seed SQL failed: ${err instanceof Error ? err.message : String(err)} — continuing without seed`,
        "warn"
      );
    }
  }

  // 7. Set Vercel env var NEXT_PUBLIC_BACKEND_URL pointing to the Fly backend
  let vercelUrl: string | null = null;
  try {
    await log(`Setting NEXT_PUBLIC_BACKEND_URL = ${flyAppUrl} on Vercel...`);
    const envVar = await vercel.setEnvVar(
      "NEXT_PUBLIC_BACKEND_URL",
      flyAppUrl,
      opts.branch
    );
    created.vercelEnvVarId = envVar.id;
    if (envVar.branchScoped) {
      await log(`Env var set (branch-scoped to: ${opts.branch})`);
    } else {
      await log(
        "Env var set as preview-wide (branch not yet registered with Vercel)"
      );
    }
  } catch (err) {
    await failWith(err);
  }

  // 8. Trigger Vercel deployment so the frontend builds with the new backend URL
  await log("Triggering Vercel frontend deployment...");
  try {
    const deployment = await vercel.triggerBranchDeployment(opts.branch);
    if (!deployment) {
      await log(
        "Vercel deployment trigger skipped — no connected GitHub repo on project",
        "warn"
      );
    } else {
      await log(`Vercel deployment created: ${deployment.uid}`);
      vercelUrl = `https://${deployment.url}`;
      await log(`Frontend URL: ${vercelUrl} (building...)`);
      await log("Waiting for Vercel build to finish...");

      const result = await vercel.waitForDeployment(
        deployment.uid,
        10 * 60_000,
        15_000
      );
      if (result.state === "READY" && result.url) {
        vercelUrl = result.url;
        await log(`Frontend build complete: ${vercelUrl}`);
      } else {
        await log(
          `Build ended with state: ${result.state} — frontend URL may still work once build retries`,
          "warn"
        );
      }
    }
  } catch (err) {
    await log(
      `Vercel deployment failed: ${err instanceof Error ? err.message : String(err)} — backend is still healthy at ${flyAppUrl}`,
      "warn"
    );
  }

  // ── Success ─────────────────────────────────────────────────────────────────
  await log("Provisioning complete ✓");
  await prisma.environment.update({
    where: { id: env.id },
    data: {
      status: "RUNNING",
      isHealthy: true,
      vercelUrl,
      vercelEnvVarId: created.vercelEnvVarId,
      serviceSecret: ephemeralServiceSecret,
      errorLog: null,
      provisionLog: logLines.join("\n"),
      lastHealthAt: new Date(),
    },
  });

  return env.id;
}

export async function destroyEnvironment(id: string): Promise<void> {
  const env = await prisma.environment.findUnique({ where: { id } });
  if (!env) throw new Error(`Environment ${id} not found`);

  const errors: Error[] = [];

  if (env.flyAppName) {
    try {
      const machines = await fly.listMachines(env.flyAppName);
      for (const m of machines) {
        await fly.destroyMachine(env.flyAppName, m.id);
      }
      await fly.deleteApp(env.flyAppName);
    } catch (err) {
      errors.push(err instanceof Error ? err : new Error(String(err)));
    }
  }

  if (env.flyDbName) {
    try {
      await fly.deletePostgresCluster(env.flyDbName);
    } catch (err) {
      errors.push(err instanceof Error ? err : new Error(String(err)));
    }
  }

  if (env.vercelEnvVarId) {
    try {
      await vercel.deleteEnvVar(env.vercelEnvVarId);
    } catch (err) {
      errors.push(err instanceof Error ? err : new Error(String(err)));
    }
  }

  await prisma.environment.delete({ where: { id } });

  if (errors.length > 0) {
    console.error(
      `Destroy env ${id} completed with ${errors.length} error(s):`,
      errors.map((e) => e.message)
    );
  }
}
