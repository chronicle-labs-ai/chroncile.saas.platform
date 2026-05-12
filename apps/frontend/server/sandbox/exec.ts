import "server-only";

import { dropShellSession, ensureShellSession } from "./store";
import type { SandboxExecResult } from "./types";

/*
 * Execute a single shell command against a sandbox-bound shell
 * session. Re-tries once on session failures (Daytona occasionally
 * reaps sessions on its own — see comment in `runOnce` below).
 */
export async function executeInEnvironmentSandbox(
  environmentId: string,
  command: string,
): Promise<SandboxExecResult> {
  const runOnce = async () => {
    const { sandbox, sessionId } = await ensureShellSession(environmentId);
    const response = await sandbox.process.executeSessionCommand(sessionId, {
      command,
      runAsync: false,
    });
    return { sandbox, sessionId, response };
  };

  let attempt;
  try {
    attempt = await runOnce();
  } catch (err) {
    // Session may have been reaped by the sandbox (e.g. start/stop, or
    // server restart that re-created the in-memory sandbox handle).
    // Drop the cached id and try once more with a fresh session.
    dropShellSession(environmentId);
    attempt = await runOnce();
    if (process.env.NODE_ENV !== "production") {
      console.warn("[daytona] session retry recovered", {
        environmentId,
        firstError: err instanceof Error ? err.message : err,
      });
    }
  }

  const { sandbox, sessionId, response } = attempt;
  const stdout = response.stdout ?? response.output ?? "";
  const stderr = response.stderr ?? "";
  const merged = stderr
    ? stdout && !stdout.endsWith("\n")
      ? `${stdout}\n${stderr}`
      : `${stdout}${stderr}`
    : stdout;
  const exitCode =
    typeof response.exitCode === "number" ? response.exitCode : 0;

  if (process.env.NODE_ENV !== "production") {
    console.log("[daytona] exec", {
      sandboxId: sandbox.id,
      sessionId,
      command,
      exitCode,
      stdoutLength: stdout.length,
      stderrLength: stderr.length,
    });
  }

  return {
    sandboxId: sandbox.id,
    exitCode,
    output: merged,
  };
}
