import "server-only";

import { dropShellSession, getSandboxForEnvironment } from "./store";
import type { SandboxLifecycleResult } from "./types";

/*
 * Start / stop the sandbox bound to an environment.
 *
 * Both calls drop the cached shell session id — Daytona tears down
 * sessions across a stop/start cycle, so the next exec needs a fresh
 * one.
 */

export async function startEnvironmentSandbox(
  environmentId: string,
): Promise<SandboxLifecycleResult> {
  const sandbox = await getSandboxForEnvironment(environmentId);
  await sandbox.start();
  await sandbox.refreshData();
  dropShellSession(environmentId);
  return {
    sandboxId: sandbox.id,
    status: sandbox.state ?? "unknown",
  };
}

export async function stopEnvironmentSandbox(
  environmentId: string,
): Promise<SandboxLifecycleResult> {
  const sandbox = await getSandboxForEnvironment(environmentId);
  await sandbox.stop();
  await sandbox.refreshData();
  dropShellSession(environmentId);
  return {
    sandboxId: sandbox.id,
    status: sandbox.state ?? "unknown",
  };
}
