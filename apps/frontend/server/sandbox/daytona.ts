/*
 * Backwards-compatible re-export shim.
 *
 * The Daytona helpers now live split per concern in `./client.ts`,
 * `./store.ts`, `./exec.ts`, `./lifecycle.ts`, `./stats.ts`. New code
 * should import from `@/server/sandbox` (the index barrel) directly.
 */
export {
  executeInEnvironmentSandbox,
  fetchEnvironmentSandboxStats,
  startEnvironmentSandbox,
  stopEnvironmentSandbox,
  getSandboxForEnvironment,
} from "./index";
export type {
  SandboxExecResult,
  SandboxLifecycleResult,
  SandboxStatsResult,
} from "./types";
