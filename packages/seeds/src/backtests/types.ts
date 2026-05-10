/*
 * Backtests seed shape.
 *
 * The mock provider boots its `MockStore` from `BacktestsSeedData`;
 * the dashboard route reads through `useBacktestsRuns()` /
 * `useBacktestsAvailability()` / `useBacktestsScene()` and feeds
 * `BacktestsManager`.
 *
 * Optional `initialStage` + `initialRecipe` (+ `divergences` /
 * `metrics`) let a seed land the route directly on a pre-baked
 * Results page — used by the `chronicle-demo` scenario to surface
 * the demo's failure-reveal beat without the user having to click
 * through Configure.
 */

import type {
  AgentSummary,
  BacktestDivergence,
  BacktestMetric,
  BacktestRecipe,
  BacktestRunSummary,
  BacktestStage,
  Dataset,
  DatasetSnapshot,
  SandboxEnvironment,
} from "ui";

import type { Seed } from "../types";

export interface BacktestsSeedData {
  /** Manager-list rows. Order is preserved when rendered. */
  runs: readonly BacktestRunSummary[];
  /** Datasets shown in the Configure step-01 picker. */
  availableDatasets: readonly Dataset[];
  /** Per-dataset snapshot lookup so step-01 can render clusters
   *  and density for the selected dataset. Keys MUST match the
   *  ids in `availableDatasets`. */
  availableDatasetSnapshots: Readonly<Record<string, DatasetSnapshot>>;
  /** Sandbox environments shown in the Configure step-02 picker. */
  availableEnvironments: readonly SandboxEnvironment[];
  /** Agents shown in the Configure step-03 picker. The picker maps
   *  each summary to a `BacktestAgent` with id `name@latestVersion`. */
  availableAgents: readonly AgentSummary[];
  /** When set, the manager skips the list and lands directly on the
   *  named stage. Pair with `initialRecipe` for `"results"`. */
  initialStage?: BacktestStage;
  /** Pre-seeded recipe — required when `initialStage` is `"results"`
   *  or `"running"`; ignored otherwise. */
  initialRecipe?: BacktestRecipe;
  /** Override divergences shown on Results / Running. Required for
   *  the Results stage to render the failure-reveal panel. */
  divergences?: readonly BacktestDivergence[];
  /** Override metrics shown on the Results metrics table. */
  metrics?: readonly BacktestMetric[];
}

export type BacktestsSeed = Seed<BacktestsSeedData>;
