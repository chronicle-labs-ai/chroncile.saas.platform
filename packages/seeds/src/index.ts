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
  defaultAgentsSeed,
  emptyAgentsSeed,
  resolveAgentsSeed,
} from "./agents";
export type { AgentsSeed, AgentsSeedData } from "./agents";

export {
  CONNECTIONS_SEEDS,
  defaultConnectionsSeed,
  emptyConnectionsSeed,
  resolveConnectionsSeed,
} from "./connections";
export type { ConnectionsSeed, ConnectionsSeedData } from "./connections";

export {
  DATASETS_SEEDS,
  defaultDatasetsSeed,
  emptyDatasetsSeed,
  powerUserDatasetsSeed,
  resolveDatasetsSeed,
} from "./datasets";
export type { DatasetsSeed, DatasetsSeedData } from "./datasets";

export {
  TIMELINE_SEEDS,
  defaultTimelineSeed,
  emptyTimelineSeed,
  supportFlowTimelineSeed,
  resolveTimelineSeed,
} from "./timeline";
export type { TimelineSeed, TimelineSeedData } from "./timeline";
