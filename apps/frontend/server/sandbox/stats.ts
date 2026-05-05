import "server-only";

import { getSandboxForEnvironment } from "./store";
import type { SandboxStatsResult } from "./types";

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
  environmentId: string,
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
