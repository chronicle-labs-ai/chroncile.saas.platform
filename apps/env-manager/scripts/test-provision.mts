#!/usr/bin/env node
/**
 * Provision test script — runs each step of the ephemeral provisioning
 * flow individually so we can see exactly where it fails.
 *
 * Usage: npx tsx scripts/test-provision.mts [branch]
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });

const BRANCH = process.argv[2] ?? "test/ephemeral-env-test";
const FLY_REGION = "ams";
const BACKEND_IMAGE = "registry.fly.io/chronicle-backend@sha256:a0fd87f1725f814394735cc9511abfe855f96b697d93319d1d0090de147dd418";

const FLY_API_BASE = "https://api.machines.dev/v1";
const rawToken = process.env.FLY_API_TOKEN ?? "";
// Machines API uses FlyV1 scheme; GraphQL uses Bearer with raw token
const token = rawToken;
const flyV1Header = rawToken.startsWith("FlyV1 ") ? rawToken : `FlyV1 ${rawToken}`;
const bearerHeader = `Bearer ${rawToken.replace(/^FlyV1\s+/, "")}`;
const orgSlug = process.env.FLY_ORG_SLUG;
const githubToken = process.env.GITHUB_TOKEN;
const githubOwner = process.env.GITHUB_OWNER;
const githubRepo = process.env.GITHUB_REPO;

function slug(branch: string) {
  return branch
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-/, "")
    .replace(/-$/, "")
    .slice(0, 12) // chronicle-backend- = 18 chars; Fly max 30 total
    .replace(/-$/, "");
}

function pass(msg: string) { console.log(`  ✅  ${msg}`); }
function fail(msg: string) { console.log(`  ❌  ${msg}`); }
function info(msg: string) { console.log(`  ℹ️   ${msg}`); }
function section(msg: string) { console.log(`\n━━━ ${msg} ━━━`); }

async function safeJson<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text.trim()) return null;
  try { return JSON.parse(text) as T; } catch { return null; }
}

// ─── 1. ENV VARS ────────────────────────────────────────────────────────────
section("1. Environment Variables");
const required = [
  ["FLY_API_TOKEN",   token],
  ["FLY_ORG_SLUG",   orgSlug],
  ["GITHUB_TOKEN",   githubToken],
  ["GITHUB_OWNER",   githubOwner],
  ["GITHUB_REPO",    githubRepo],
];
let envOk = true;
for (const [key, val] of required) {
  if (val) pass(`${key} is set`);
  else { fail(`${key} is missing`); envOk = false; }
}
if (!envOk) { console.log("\nFix missing env vars before continuing."); process.exit(1); }

// ─── 2. FLY AUTH ─────────────────────────────────────────────────────────────
section("2. Fly.io Authentication");
try {
  const res = await fetch(`${FLY_API_BASE}/apps?org_slug=${orgSlug}`, {
    headers: { Authorization: flyV1Header, "Content-Type": "application/json" },
  });
  if (res.ok) {
    const data = await safeJson<{ apps: Array<{ name: string }> }>(res);
    pass(`Authenticated. ${data?.apps?.length ?? "?"} apps in org ${orgSlug}`);
  } else {
    fail(`Fly auth failed: HTTP ${res.status} — ${await res.text()}`);
    process.exit(1);
  }
} catch (e) {
  fail(`Fly auth error: ${e}`);
  process.exit(1);
}

// ─── 3. GITHUB BRANCH INFO ───────────────────────────────────────────────────
section(`3. GitHub Branch: ${BRANCH}`);
let branchSha = "";
try {
  const encoded = encodeURIComponent(BRANCH);
  const res = await fetch(
    `https://api.github.com/repos/${githubOwner}/${githubRepo}/branches/${encoded}`,
    { headers: { Authorization: `Bearer ${githubToken}`, "User-Agent": "env-manager-test" } }
  );
  if (res.ok) {
    const data = await safeJson<{ commit: { sha: string; commit: { message: string } } }>(res);
    branchSha = data?.commit.sha ?? "";
    pass(`Branch found. SHA: ${branchSha.slice(0, 7)} — "${data?.commit.commit.message.split("\n")[0]}"`);
  } else {
    fail(`GitHub branch fetch failed: HTTP ${res.status}`);
  }
} catch (e) {
  fail(`GitHub error: ${e}`);
}

// ─── 4. FLY APP CREATE ───────────────────────────────────────────────────────
const appSlug = slug(BRANCH);
const flyAppName = `chronicle-backend-${appSlug}`;
const flyDbName  = `chronicle-db-${appSlug}`;
const flyAppUrl  = `https://${flyAppName}.fly.dev`;

section(`4. Fly App: ${flyAppName}`);
try {
  const checkRes = await fetch(`${FLY_API_BASE}/apps/${flyAppName}`, {
    headers: { Authorization: flyV1Header },
  });
  if (checkRes.ok) {
    const app = await safeJson<{ name: string; status: string }>(checkRes);
    info(`App already exists: ${app?.name} (status: ${app?.status})`);
  } else if (checkRes.status === 404) {
    info("App does not exist yet — will create");
    const createRes = await fetch(`${FLY_API_BASE}/apps`, {
      method: "POST",
      headers: { Authorization: flyV1Header, "Content-Type": "application/json" },
      body: JSON.stringify({ app_name: flyAppName, org_slug: orgSlug }),
    });
    if (createRes.ok || createRes.status === 201) {
      pass(`App created: ${flyAppName}`);
    } else {
      const body = await createRes.text();
      fail(`App creation failed: HTTP ${createRes.status} — ${body}`);
    }
  } else {
    fail(`Fly app check failed: HTTP ${checkRes.status}`);
  }
} catch (e) {
  fail(`Fly app error: ${e}`);
}

// ─── 5. FLY POSTGRES ─────────────────────────────────────────────────────────
section(`5. Fly Postgres: ${flyDbName}`);
try {
  const checkRes = await fetch(`${FLY_API_BASE}/apps/${flyDbName}`, {
    headers: { Authorization: flyV1Header },
  });
  if (checkRes.ok) {
    info(`Postgres app already exists: ${flyDbName}`);
    pass("Skipping creation");
  } else {
    info("No existing Postgres app — creating via flyctl CLI...");
    const { execFile } = await import("child_process");
    const { promisify } = await import("util");
    const exec = promisify(execFile);
    try {
      const { stdout, stderr } = await exec("flyctl", [
        "postgres", "create",
        "--name", flyDbName,
        "--org", orgSlug!,
        "--region", FLY_REGION,
        "--vm-size", "shared-cpu-1x",
        "--volume-size", "1",
        "--initial-cluster-size", "1",
      ], { env: { ...process.env }, timeout: 120_000 });
      const output = stdout + stderr;
      info(`flyctl output:\n${output.slice(0, 400)}`);
      const passwordMatch = output.match(/Password:\s*(\S+)/);
      if (passwordMatch) {
        pass(`Postgres created. Password extracted.`);
      } else {
        pass(`Postgres created (no password in output — check manually)`);
      }
    } catch (e) {
      fail(`flyctl postgres create failed: ${e instanceof Error ? e.message : e}`);
    }
  }
} catch (e) {
  fail(`Postgres check error: ${e}`);
}

// ─── 6. FLY SECRETS ──────────────────────────────────────────────────────────
section(`6. Fly Secrets on ${flyAppName}`);
try {
  const gqlRes = await fetch("https://api.fly.io/graphql", {
    method: "POST",
    headers: { Authorization: bearerHeader, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `
        mutation($input: SetSecretsInput!) {
          setSecrets(input: $input) { app { name } }
        }
      `,
      variables: {
        input: {
          appId: flyAppName,
          secrets: [
            { key: "GIT_SHA", value: branchSha || "test" },
            { key: "ENVIRONMENT", value: "ephemeral" },
            { key: "BACKEND_MODE", value: "real" },
            { key: "AUTH_SECRET", value: "test-secret-change-in-production-at-least-32" },
          ],
        },
      },
    }),
  });
  const data = await safeJson<{ data?: unknown; errors?: Array<{ message: string }> }>(gqlRes);
  if (data?.errors?.length) {
    fail(`Set secrets errors: ${(data.errors as Array<{message: string}>).map(e => e.message).join(", ")}`);
  } else {
    pass("Secrets set successfully");
  }
} catch (e) {
  fail(`Secrets error: ${e}`);
}

// ─── 7. FLY MACHINE ──────────────────────────────────────────────────────────
section(`7. Fly Machine on ${flyAppName}`);
try {
  const listRes = await fetch(`${FLY_API_BASE}/apps/${flyAppName}/machines`, {
    headers: { Authorization: flyV1Header },
  });
  const machines = (await safeJson<Array<{ id: string; state: string }>>(listRes)) ?? [];
  if (machines.length > 0) {
    info(`Machine(s) already exist: ${machines.map(m => `${m.id} (${m.state})`).join(", ")}`);
    pass("Skipping machine creation");
  } else {
    info(`Creating machine with image: ${BACKEND_IMAGE}`);
    const createRes = await fetch(`${FLY_API_BASE}/apps/${flyAppName}/machines`, {
      method: "POST",
      headers: { Authorization: flyV1Header, "Content-Type": "application/json" },
      body: JSON.stringify({
        region: FLY_REGION,
        config: {
          image: BACKEND_IMAGE,
          env: { BACKEND_MODE: "real", ENVIRONMENT: "ephemeral", GIT_SHA: branchSha || "test" },
          guest: { cpus: 1, memory_mb: 256, cpu_kind: "shared" },
          services: [{
            ports: [{ port: 443, handlers: ["tls", "http"] }, { port: 80, handlers: ["http"] }],
            internal_port: 8080,
            protocol: "tcp",
          }],
        },
      }),
    });
    const machine = await safeJson<{ id: string; state: string }>(createRes);
    if (createRes.ok && machine) {
      pass(`Machine created: ${machine.id} (${machine.state})`);
    } else {
      fail(`Machine creation failed: HTTP ${createRes.status} — ${JSON.stringify(machine)}`);
    }
  }
} catch (e) {
  fail(`Machine error: ${e}`);
}

// ─── 8. HEALTH CHECK ─────────────────────────────────────────────────────────
section(`8. Backend Health: ${flyAppUrl}/health`);
info("Polling for up to 30s...");
let healthy = false;
for (let i = 0; i < 6; i++) {
  try {
    const res = await fetch(`${flyAppUrl}/health`, { signal: AbortSignal.timeout(5_000) });
    if (res.ok) {
      const data = await safeJson<{ status: string; gitSha?: string }>(res);
      pass(`Backend healthy! ${JSON.stringify(data)}`);
      healthy = true;
      break;
    } else {
      info(`Attempt ${i+1}: HTTP ${res.status}`);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    info(`Attempt ${i+1}: ${msg}`);
  }
  await new Promise(r => setTimeout(r, 5_000));
}
if (!healthy) fail("Backend not healthy after 30s — may need more time to start");

// ─── SUMMARY ─────────────────────────────────────────────────────────────────
section("Summary");
info(`Fly app:  https://fly.io/apps/${flyAppName}`);
info(`Fly DB:   https://fly.io/apps/${flyDbName}`);
info(`App URL:  ${flyAppUrl}`);
