import "server-only";

import { Daytona, type Sandbox } from "@daytonaio/sdk";

/*
 * Daytona sandbox manager — lazy, in-process map keyed by environment id.
 *
 * Single-instance only (memory map). Restarting the dev server orphans
 * sandboxes server-side; the next exec will create a fresh one. Real
 * deployments need to back this with a durable store (Postgres) and a
 * background reaper that calls `sandbox.delete()` on stale entries.
 */

let daytonaClient: Daytona | null = null;

function getDaytona(): Daytona {
  if (daytonaClient) return daytonaClient;
  const apiKey = process.env.DAYTONA_API_KEY;
  if (!apiKey) {
    throw new Error(
      "DAYTONA_API_KEY is not configured. Set it in apps/frontend/.env.local."
    );
  }
  daytonaClient = new Daytona({
    apiKey,
    apiUrl: process.env.DAYTONA_API_URL,
  });
  return daytonaClient;
}

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
  environmentId: string
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

async function ensureShellSession(
  environmentId: string
): Promise<{ sandbox: Sandbox; sessionId: string }> {
  const sandbox = await getSandboxForEnvironment(environmentId);
  let sessionId = shellSessions.get(environmentId);
  if (sessionId) return { sandbox, sessionId };

  sessionId = `chronicle-shell-${Math.random().toString(36).slice(2, 10)}`;
  await sandbox.process.createSession(sessionId);
  shellSessions.set(environmentId, sessionId);
  return { sandbox, sessionId };
}

function dropShellSession(environmentId: string) {
  shellSessions.delete(environmentId);
}

export interface SandboxExecResult {
  sandboxId: string;
  exitCode: number;
  output: string;
}

export interface SandboxStatsResult {
  sandboxId: string;
  status: string;
  vCpu: number;
  cpuPct: number;
  memoryUsedGib: number;
  memoryTotalGib: number;
  memoryPct: number;
  diskUsedGib: number;
  diskTotalGib: number;
  diskPct: number;
}

export interface SandboxLifecycleResult {
  sandboxId: string;
  status: string;
}

export async function executeInEnvironmentSandbox(
  environmentId: string,
  command: string
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

export async function startEnvironmentSandbox(
  environmentId: string
): Promise<SandboxLifecycleResult> {
  const sandbox = await getSandboxForEnvironment(environmentId);
  await sandbox.start();
  await sandbox.refreshData();
  // The shell session is gone after a stop/start cycle; drop the cached
  // id so the next exec creates a fresh one.
  dropShellSession(environmentId);
  return {
    sandboxId: sandbox.id,
    status: sandbox.state ?? "unknown",
  };
}

export async function stopEnvironmentSandbox(
  environmentId: string
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

/*
 * One-shot busybox-friendly /proc reader. Pipe-separated so we don't
 * need to escape JSON inside the shell. Format:
 *   nproc|cpuPct|memUsedKb|memTotalKb|diskUsedKb|diskTotalKb
 */
const STATS_SCRIPT =
  "N=$(nproc 2>/dev/null || echo 1); " +
  "C=$(awk '/^cpu / {idle=$5; total=0; for(i=2;i<=NF;i++) total+=$i; if (total>0) printf \"%.0f\", (total-idle)*100/total; else printf \"0\"; exit}' /proc/stat); " +
  "MU=$(awk '/^MemAvailable:/ {avail=$2} /^MemTotal:/ {total=$2} END {printf \"%d\", total-avail}' /proc/meminfo); " +
  "MT=$(awk '/^MemTotal:/ {print $2; exit}' /proc/meminfo); " +
  "DU=$(df -k / | awk 'NR==2 {print $3}'); " +
  "DT=$(df -k / | awk 'NR==2 {print $2}'); " +
  'echo "$N|$C|$MU|$MT|$DU|$DT"';

export async function fetchEnvironmentSandboxStats(
  environmentId: string
): Promise<SandboxStatsResult> {
  const sandbox = await getSandboxForEnvironment(environmentId);
  await sandbox.refreshData();
  const state = sandbox.state ?? "unknown";
  if (state !== "started") {
    return {
      sandboxId: sandbox.id,
      status: state,
      vCpu: 0,
      cpuPct: 0,
      memoryUsedGib: 0,
      memoryTotalGib: 0,
      memoryPct: 0,
      diskUsedGib: 0,
      diskTotalGib: 0,
      diskPct: 0,
    };
  }

  const response = await sandbox.process.executeCommand(STATS_SCRIPT);
  const raw = (response.result ?? "").trim();
  const lastLine = raw.split("\n").filter(Boolean).pop() ?? "";
  const parts = lastLine.split("|");
  if (parts.length < 6) {
    throw new Error(`unexpected stats output: ${raw}`);
  }

  const num = (v: string | undefined) => Number(v ?? 0) || 0;
  const vCpu = num(parts[0]);
  const cpuPct = clampPct(num(parts[1]));
  const memUsedKb = num(parts[2]);
  const memTotalKb = num(parts[3]);
  const diskUsedKb = num(parts[4]);
  const diskTotalKb = num(parts[5]);

  return {
    sandboxId: sandbox.id,
    status: state,
    vCpu,
    cpuPct,
    memoryUsedGib: kbToGib(memUsedKb),
    memoryTotalGib: kbToGib(memTotalKb),
    memoryPct:
      memTotalKb > 0 ? clampPct((memUsedKb / memTotalKb) * 100) : 0,
    diskUsedGib: kbToGib(diskUsedKb),
    diskTotalGib: kbToGib(diskTotalKb),
    diskPct:
      diskTotalKb > 0 ? clampPct((diskUsedKb / diskTotalKb) * 100) : 0,
  };
}

function kbToGib(kb: number): number {
  return Math.round((kb / 1024 / 1024) * 100) / 100;
}

function clampPct(pct: number): number {
  if (!Number.isFinite(pct)) return 0;
  if (pct < 0) return 0;
  if (pct > 100) return 100;
  return Math.round(pct);
}
