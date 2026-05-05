/*
 * Daytona-backed sandbox helpers, split per concern. Each sandbox API
 * route imports just what it needs from this barrel; the existing
 * `@/server/sandbox/daytona` import path is preserved as a re-export
 * shim for backwards compatibility.
 */

export { getDaytona } from "./client";
export {
  getSandboxForEnvironment,
  ensureShellSession,
  dropShellSession,
} from "./store";
export { executeInEnvironmentSandbox } from "./exec";
export {
  startEnvironmentSandbox,
  stopEnvironmentSandbox,
} from "./lifecycle";
export { fetchEnvironmentSandboxStats } from "./stats";
export type {
  SandboxExecResult,
  SandboxLifecycleResult,
  SandboxStatsResult,
} from "./types";
