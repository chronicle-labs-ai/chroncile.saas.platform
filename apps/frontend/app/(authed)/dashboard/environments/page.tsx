"use client";

import {
  EnvironmentsManager,
  type SandboxExecuteResult,
  type SandboxLifecycleResult,
  type SandboxLiveStats,
  type SandboxRuntimeStatus,
} from "ui";

/*
 * /dashboard/environments
 *
 * Renders the customer-facing Environments surface: sandbox companies
 * where agents operate with seeded data, MCP servers, CLIs, agent
 * identities, scenarios, and injected failure states.
 *
 * Sandbox lifecycle (start/stop), live stats polling, and the Terminal
 * lens shell all proxy through `/api/sandbox/*` against a Daytona
 * sandbox keyed per environment.
 */

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as
    | (T & { error?: never })
    | { error?: string };
  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "error" in payload
        ? (payload.error ?? `HTTP ${response.status}`)
        : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload as T;
}

async function executeSandboxCommand(
  environmentId: string,
  command: string
): Promise<SandboxExecuteResult> {
  const body = await postJson<{
    output?: string;
    exitCode?: number;
    sandboxId?: string;
  }>("/api/sandbox/exec", { environmentId, command });
  return {
    output: body.output ?? "",
    exitCode: typeof body.exitCode === "number" ? body.exitCode : 1,
    sandboxId: body.sandboxId,
  };
}

async function fetchSandboxStats(
  environmentId: string
): Promise<SandboxLiveStats> {
  const body = await postJson<{
    sandboxId?: string;
    status?: SandboxRuntimeStatus;
    vCpu?: number;
    cpuPct?: number;
    memoryUsedGib?: number;
    memoryTotalGib?: number;
    memoryPct?: number;
    diskUsedGib?: number;
    diskTotalGib?: number;
    diskPct?: number;
  }>("/api/sandbox/stats", { environmentId });
  return {
    sandboxId: body.sandboxId,
    status: (body.status ?? "unknown") as SandboxRuntimeStatus,
    vCpu: body.vCpu ?? 0,
    cpuPct: body.cpuPct ?? 0,
    memoryUsedGib: body.memoryUsedGib ?? 0,
    memoryTotalGib: body.memoryTotalGib ?? 0,
    memoryPct: body.memoryPct ?? 0,
    diskUsedGib: body.diskUsedGib ?? 0,
    diskTotalGib: body.diskTotalGib ?? 0,
    diskPct: body.diskPct ?? 0,
  };
}

async function controlSandbox(
  environmentId: string,
  action: "start" | "stop"
): Promise<SandboxLifecycleResult> {
  const body = await postJson<{
    sandboxId?: string;
    status?: SandboxRuntimeStatus;
  }>("/api/sandbox/lifecycle", { environmentId, action });
  return {
    sandboxId: body.sandboxId,
    status: (body.status ?? "unknown") as SandboxRuntimeStatus,
  };
}

const startSandbox = (environmentId: string) =>
  controlSandbox(environmentId, "start");
const stopSandbox = (environmentId: string) =>
  controlSandbox(environmentId, "stop");

export default function EnvironmentsPage() {
  return (
    <div
      className="flex min-h-0 flex-col"
      style={{
        height: "calc(100svh - var(--header-height, 3.5rem) - 2rem)",
      }}
    >
      <EnvironmentsManager
        onExecute={executeSandboxCommand}
        onFetchStats={fetchSandboxStats}
        onStartSandbox={startSandbox}
        onStopSandbox={stopSandbox}
      />
    </div>
  );
}
