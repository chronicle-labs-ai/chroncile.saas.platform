import "server-only";

import type { Sandbox } from "@daytonaio/sdk";

import { getDaytona } from "./client";

/*
 * In-process sandbox store keyed by environment id.
 *
 * Single-instance only (memory map). Restarting the dev server orphans
 * sandboxes server-side; the next exec will create a fresh one. Real
 * deployments need to back this with a durable store (Postgres) and a
 * background reaper that calls `sandbox.delete()` on stale entries.
 */

const sandboxes = new Map<string, Sandbox>();
const inFlight = new Map<string, Promise<Sandbox>>();
const shellSessions = new Map<string, string>();

async function provisionSandbox(environmentId: string): Promise<Sandbox> {
  const daytona = getDaytona();
  const sandbox = await daytona.create({
    labels: {
      "chronicle.environment.id": environmentId,
      "chronicle.surface": "environments-terminal",
    },
  });
  sandboxes.set(environmentId, sandbox);
  return sandbox;
}

export async function getSandboxForEnvironment(
  environmentId: string,
): Promise<Sandbox> {
  const existing = sandboxes.get(environmentId);
  if (existing) return existing;

  const pending = inFlight.get(environmentId);
  if (pending) return pending;

  const promise = provisionSandbox(environmentId).finally(() => {
    inFlight.delete(environmentId);
  });
  inFlight.set(environmentId, promise);
  return promise;
}

export async function ensureShellSession(
  environmentId: string,
): Promise<{ sandbox: Sandbox; sessionId: string }> {
  const sandbox = await getSandboxForEnvironment(environmentId);
  let sessionId = shellSessions.get(environmentId);
  if (sessionId) return { sandbox, sessionId };

  sessionId = `chronicle-shell-${Math.random().toString(36).slice(2, 10)}`;
  await sandbox.process.createSession(sessionId);
  shellSessions.set(environmentId, sessionId);
  return { sandbox, sessionId };
}

export function dropShellSession(environmentId: string) {
  shellSessions.delete(environmentId);
}
