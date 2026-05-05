/*
 * Shared response shapes for the sandbox helpers. The matching client
 * types in `packages/ui/src/environments/types.ts` are intentionally
 * isomorphic — these stay server-side so we can evolve them without
 * touching the design system.
 */

export interface SandboxExecResult {
  sandboxId: string;
  exitCode: number;
  output: string;
}

export interface SandboxLifecycleResult {
  sandboxId: string;
  status: string;
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
