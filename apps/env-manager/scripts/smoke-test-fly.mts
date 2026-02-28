#!/usr/bin/env node
/**
 * Fly.io account smoke test
 * Verifies the account is in good standing before attempting any provisioning.
 *
 * Usage: npx tsx scripts/smoke-test-fly.mts
 */
import { config } from "dotenv";
import { resolve } from "path";
import { execFile } from "child_process";
import { promisify } from "util";

config({ path: resolve(process.cwd(), ".env") });

const exec = promisify(execFile);
const rawToken = process.env.FLY_API_TOKEN ?? "";
const orgSlug  = process.env.FLY_ORG_SLUG  ?? "";

const FLY_API_BASE = "https://api.machines.dev/v1";
const flyV1Header  = `FlyV1 ${rawToken.replace(/^FlyV1\s+/, "")}`;

let passed = 0;
let failed = 0;

function pass(msg: string) { console.log(`  ✅  ${msg}`); passed++; }
function fail(msg: string) { console.log(`  ❌  ${msg}`); failed++; }
function info(msg: string) { console.log(`  ℹ️   ${msg}`); }
function section(msg: string) { console.log(`\n━━━ ${msg} ━━━`); }

async function safeJson<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text.trim()) return null;
  try { return JSON.parse(text) as T; } catch { return null; }
}

section("1. Token present");
if (rawToken) pass("FLY_API_TOKEN is set");
else { fail("FLY_API_TOKEN is not set"); process.exit(1); }
if (orgSlug) pass(`FLY_ORG_SLUG = "${orgSlug}"`);
else fail("FLY_ORG_SLUG is not set");

section("2. Machines API authentication");
try {
  const res = await fetch(`${FLY_API_BASE}/apps?org_slug=${orgSlug}`, {
    headers: { Authorization: flyV1Header },
  });
  const data = await safeJson<{ apps?: unknown[]; error?: string }>(res);
  if (res.ok) {
    pass(`Machines API auth OK (HTTP ${res.status})`);
    info(`Apps in org: ${data?.apps?.length ?? 0}`);
  } else if (res.status === 403) {
    fail(`Machines API auth rejected — check token (HTTP 403)`);
    info(`Response: ${JSON.stringify(data)}`);
  } else {
    fail(`Unexpected response: HTTP ${res.status} — ${JSON.stringify(data)}`);
  }
} catch (e) {
  fail(`Machines API request failed: ${e}`);
}

section("3. Account standing — dry-run app create");
try {
  const dryRunName = `smoke-test-${Date.now()}`;
  const res = await fetch(`${FLY_API_BASE}/apps`, {
    method: "POST",
    headers: { Authorization: flyV1Header, "Content-Type": "application/json" },
    body: JSON.stringify({ app_name: dryRunName, org_slug: orgSlug }),
  });
  const data = await safeJson<{ id?: string; name?: string; error?: string }>(res);

  if (res.ok || res.status === 201) {
    pass("Account is in good standing — app creation allowed");
    info(`Dry-run app created: ${data?.name ?? dryRunName} — cleaning up...`);
    // immediately delete the test app
    await fetch(`${FLY_API_BASE}/apps/${dryRunName}`, {
      method: "DELETE",
      headers: { Authorization: flyV1Header },
    });
    info("Dry-run app deleted");
  } else if (res.status === 422 && data?.error?.includes("high risk")) {
    fail("Account is HIGH RISK — new app creation is BLOCKED");
    fail("Action required: https://fly.io/high-risk-unlock");
  } else if (res.status === 422 && data?.error?.includes("already exists")) {
    pass("Account standing OK (name collision — account can create apps)");
  } else {
    fail(`Unexpected: HTTP ${res.status} — ${JSON.stringify(data)}`);
  }
} catch (e) {
  fail(`Create test failed: ${e}`);
}

section("4. flyctl CLI available");
try {
  const { stdout } = await exec("flyctl", ["version"]);
  pass(`flyctl found: ${stdout.trim()}`);
} catch {
  fail("flyctl not found in PATH — install from https://fly.io/docs/hands-on/install-flyctl/");
}

section("5. Existing apps accessible");
try {
  const apps = ["chronicle-backend", "chronicle-backend-staging", "chronicle-backend-dev"];
  for (const appName of apps) {
    const res = await fetch(`${FLY_API_BASE}/apps/${appName}`, {
      headers: { Authorization: flyV1Header },
    });
    const data = await safeJson<{ name: string; status: string; error?: string }>(res);
    if (res.ok && data?.name) {
      pass(`${appName} → status: ${data.status}`);
    } else if (res.status === 404) {
      info(`${appName} → not found (may not be deployed yet)`);
    } else {
      fail(`${appName} → HTTP ${res.status}: ${data?.error ?? "unknown"}`);
    }
  }
} catch (e) {
  fail(`App check failed: ${e}`);
}

// ─── Result ─────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
if (failed === 0) {
  console.log(`\n  🟢  ALL CHECKS PASSED (${passed}/${passed + failed}) — ready to provision\n`);
  process.exit(0);
} else {
  console.log(`\n  🔴  ${failed} CHECK(S) FAILED — fix issues above before provisioning\n`);
  process.exit(1);
}
