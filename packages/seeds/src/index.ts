/*
 * Seeds — public API.
 *
 * Per-domain registries live under `./agents` and `./datasets`.
 * Consumers should prefer the sub-path import
 * (`import { resolveAgentsSeed } from "seeds/agents"`) so unrelated
 * domains tree-shake. This barrel exists for the generic
 * `Seed<TData>` type, utility helpers, and the cross-domain
 * iteration the `seed:chronicle` CLI does.
 */

export { resolveSeed } from "./types";
export type { Seed } from "./types";

export { cloneArray, cloneRecord, cloneValue, rebaseTimestamps } from "./util";
export type { RebaseOptions } from "./util";

export {
  AGENTS_SEEDS,
  chronicleDemoAgentsSeed,
  defaultAgentsSeed,
  emptyAgentsSeed,
  resolveAgentsSeed,
  supportFlowAgentsSeed,
} from "./agents";
export type { AgentsSeed, AgentsSeedData } from "./agents";

export {
  CONNECTIONS_SEEDS,
  chronicleDemoConnectionsSeed,
  defaultConnectionsSeed,
  emptyConnectionsSeed,
  resolveConnectionsSeed,
  supportFlowConnectionsSeed,
} from "./connections";
export type { ConnectionsSeed, ConnectionsSeedData } from "./connections";

export {
  DATASETS_SEEDS,
  chronicleDemoDatasetsSeed,
  defaultDatasetsSeed,
  emptyDatasetsSeed,
  powerUserDatasetsSeed,
  resolveDatasetsSeed,
  supportFlowDatasetsSeed,
} from "./datasets";
export type { DatasetsSeed, DatasetsSeedData } from "./datasets";

export {
  TIMELINE_SEEDS,
  chronicleDemoTimelineSeed,
  defaultTimelineSeed,
  emptyTimelineSeed,
  supportFlowTimelineSeed,
  resolveTimelineSeed,
} from "./timeline";
export type { TimelineSeed, TimelineSeedData } from "./timeline";

export {
  BACKTESTS_SEEDS,
  chronicleDemoBacktestsSeed,
  defaultBacktestsSeed,
  emptyBacktestsSeed,
  resolveBacktestsSeed,
  supportFlowBacktestsSeed,
} from "./backtests";
export type { BacktestsSeed, BacktestsSeedData } from "./backtests";

export {
  CHRONICLE_DEMO_BILLING_ENV_ID,
  chronicleDemoBillingEnv,
  chronicleDemoEnvironmentsSeed,
  defaultEnvironmentsSeed,
  emptyEnvironmentsSeed,
  ENVIRONMENTS_SEEDS,
  resolveEnvironmentsSeed,
  supportFlowEnvironmentsSeed,
} from "./environments";
export type { EnvironmentsSeed, EnvironmentsSeedData } from "./environments";
