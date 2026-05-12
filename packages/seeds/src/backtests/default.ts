/*
 * Default backtests seed — wraps the canonical `ui` fixtures
 * (`BACKTEST_RUNS_SEED`, `BACKTEST_DIVERGENCES`, `BACKTEST_METRICS`,
 * `BACKTEST_DATASET_SNAPSHOTS`, `datasetsSeed`, `environmentsSeed`,
 * `agentsManagerSeed`) so flipping `NEXT_PUBLIC_DATA_BACKTESTS=mock`
 * with the default seed renders the same surface every Storybook
 * story shows.
 *
 * Phase A wraps the existing `ui` exports unchanged; Phase B will
 * eventually move the fixture bodies here. No `initialStage` /
 * `initialRecipe` — the route lands on the list view.
 */

import {
  BACKTEST_DATASET_SNAPSHOTS,
  BACKTEST_DIVERGENCES,
  BACKTEST_METRICS,
  BACKTEST_RUNS_SEED,
  agentsManagerSeed,
  datasetsSeed,
  environmentsSeed,
  type AgentSummary,
  type BacktestDivergence,
  type BacktestMetric,
  type BacktestRunSummary,
  type Dataset,
  type DatasetSnapshot,
  type SandboxEnvironment,
} from "ui";

import type { BacktestsSeed, BacktestsSeedData } from "./types";

export const defaultBacktestsSeed: BacktestsSeed = {
  id: "default",
  label: "Realistic workspace",
  description:
    "Storybook-equivalent set: 6 runs, 3 dataset snapshots, 5 environments, 5 agents, all reference divergences + metrics.",
  build(): BacktestsSeedData {
    return {
      runs: structuredClone(BACKTEST_RUNS_SEED) as BacktestRunSummary[],
      availableDatasets: structuredClone(datasetsSeed) as Dataset[],
      availableDatasetSnapshots: structuredClone(
        BACKTEST_DATASET_SNAPSHOTS,
      ) as Record<string, DatasetSnapshot>,
      availableEnvironments: structuredClone(
        environmentsSeed,
      ) as SandboxEnvironment[],
      availableAgents: structuredClone(agentsManagerSeed) as AgentSummary[],
      divergences: structuredClone(BACKTEST_DIVERGENCES) as BacktestDivergence[],
      metrics: structuredClone(BACKTEST_METRICS) as BacktestMetric[],
    };
  },
};
