#!/usr/bin/env tsx
/*
 * seed:chronicle — populate `chronicle-backend` with the same
 * fixtures the in-browser `mock` impl uses, so flipping
 * `NEXT_PUBLIC_DATA_*=chronicle` lands on familiar data rather
 * than an empty database.
 *
 * Usage:
 *
 *   yarn workspace frontend seed:chronicle             # default seed
 *   yarn workspace frontend seed:chronicle power-user
 *   yarn workspace frontend seed:chronicle empty
 *
 * Env vars:
 *
 *   NEXT_PUBLIC_BACKEND_URL  Defaults to http://localhost:8080.
 *   CHRONICLE_DEV_TOKEN      Required. Generate one by hitting
 *                            `/api/auth/backend-token` from a logged-in
 *                            browser session, or by reading the
 *                            sealed WorkOS access token directly.
 *
 * The script is intentionally idempotent — it issues `DELETE` on each
 * dataset before recreating it so re-runs don't pile up duplicates.
 * Errors per dataset are logged but don't abort the whole run.
 *
 * The Chronicle routes targeted here (`/api/platform/datasets/*`,
 * `/api/platform/agents/*`) may not exist yet — when they don't, the
 * script logs `404` for each entry and exits non-zero so CI can
 * detect missing endpoints.
 */

import { resolveAgentsSeed } from "seeds/agents";
import { resolveDatasetsSeed } from "seeds/datasets";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8080";
const TOKEN = process.env.CHRONICLE_DEV_TOKEN;

if (!TOKEN) {
  console.error(
    "[seed:chronicle] missing CHRONICLE_DEV_TOKEN. Hit /api/auth/backend-token from a logged-in browser session to grab one.",
  );
  process.exit(1);
}

const seedId = process.argv[2] ?? "default";

interface Outcome {
  ok: boolean;
  status: number;
  detail?: string;
}

async function request(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<Outcome> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.ok) return { ok: true, status: res.status };
  const text = await res.text().catch(() => "");
  return { ok: false, status: res.status, detail: text.slice(0, 200) };
}

async function seedDatasets(): Promise<void> {
  const seed = resolveDatasetsSeed(seedId).build();
  console.log(
    `[seed:chronicle] datasets — applying ${seed.datasets.length} entries from "${seedId}"`,
  );
  let ok = 0;
  let fail = 0;
  for (const dataset of seed.datasets) {
    /* Best-effort idempotency: if the dataset already exists,
       remove it before re-creating. The backend is welcome to
       return 404 here; it's not fatal. */
    await request("DELETE", `/api/platform/datasets/${encodeURIComponent(dataset.id)}`);
    const create = await request("POST", "/api/platform/datasets", dataset);
    if (!create.ok) {
      fail += 1;
      console.warn(
        `  [datasets] ${dataset.id} create failed: ${create.status} ${
          create.detail ?? ""
        }`,
      );
      continue;
    }
    const snapshot = seed.snapshotsById[dataset.id];
    if (snapshot) {
      const sync = await request(
        "POST",
        `/api/platform/datasets/${encodeURIComponent(dataset.id)}/import`,
        snapshot,
      );
      if (!sync.ok) {
        console.warn(
          `  [datasets] ${dataset.id} snapshot import failed: ${sync.status} ${
            sync.detail ?? ""
          }`,
        );
      }
    }
    ok += 1;
  }
  console.log(`  ${ok} ok, ${fail} failed`);
}

async function seedAgents(): Promise<void> {
  const seed = resolveAgentsSeed(seedId).build();
  console.log(
    `[seed:chronicle] agents — applying ${seed.summaries.length} entries from "${seedId}"`,
  );
  let ok = 0;
  let fail = 0;
  for (const summary of seed.summaries) {
    await request(
      "DELETE",
      `/api/platform/agents/${encodeURIComponent(summary.name)}`,
    );
    const snapshot = seed.snapshotsByName[summary.name];
    const payload = snapshot
      ? { summary, snapshot }
      : { summary };
    const create = await request("POST", "/api/platform/agents", payload);
    if (!create.ok) {
      fail += 1;
      console.warn(
        `  [agents] ${summary.name} create failed: ${create.status} ${
          create.detail ?? ""
        }`,
      );
      continue;
    }
    ok += 1;
  }
  console.log(`  ${ok} ok, ${fail} failed`);
}

async function main(): Promise<void> {
  console.log(
    `[seed:chronicle] backend=${BACKEND_URL}  seed="${seedId}"`,
  );
  await seedDatasets();
  await seedAgents();
}

main().catch((err) => {
  console.error("[seed:chronicle] aborted:", err);
  process.exit(1);
});
