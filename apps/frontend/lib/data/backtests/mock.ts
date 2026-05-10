/*
 * Mock backtests provider — backed by a `MockStore` seeded from
 * `packages/seeds/backtests`. No mutations today (Backtests has no
 * write surface yet), so `subscribe` only fanouts `runs-changed`
 * events from `reset(seedId)` swaps.
 */

import { resolveBacktestsSeed, type BacktestsSeedData } from "seeds/backtests";
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

import { getDataConfig } from "../config";
import { sleep } from "../shared/latency";
import { MockStore } from "../shared/mock-store";
import type {
  BacktestsAvailability,
  BacktestsEvent,
  BacktestsScene,
  ResettableBacktestsProvider,
} from "./types";

interface State {
  runs: BacktestRunSummary[];
  availability: BacktestsAvailability;
  scene: BacktestsScene | null;
}

function buildState(seedId?: string): State {
  const id = seedId ?? getDataConfig().seeds.backtests;
  const seed = resolveBacktestsSeed(id).build();
  return seedToState(seed);
}

function seedToState(seed: BacktestsSeedData): State {
  return {
    runs: [...seed.runs] as BacktestRunSummary[],
    availability: {
      datasets: [...seed.availableDatasets] as Dataset[],
      datasetSnapshots: { ...seed.availableDatasetSnapshots } as Record<
        string,
        DatasetSnapshot
      >,
      environments: [...seed.availableEnvironments] as SandboxEnvironment[],
      agents: [...seed.availableAgents] as AgentSummary[],
    },
    scene: hasScene(seed)
      ? {
          initialStage: seed.initialStage,
          initialRecipe: seed.initialRecipe,
          divergences: seed.divergences
            ? ([...seed.divergences] as BacktestDivergence[])
            : undefined,
          metrics: seed.metrics
            ? ([...seed.metrics] as BacktestMetric[])
            : undefined,
        }
      : null,
  };
}

/* `scene` is "present" when the seed wants the manager to land on a
   pre-baked stage (Results today, Running someday). A bare metrics /
   divergences override without `initialStage` is treated as a list-
   view seed — the manager already accepts those props on its own. */
function hasScene(seed: BacktestsSeedData): boolean {
  return Boolean(
    seed.initialStage ?? seed.initialRecipe,
  );
}

const store = new MockStore<State, BacktestsEvent>(() => buildState());

function emitRunsChanged() {
  store.emit({ kind: "runs-changed", runs: [...store.state.runs] });
}

export const mockBacktestsProvider: ResettableBacktestsProvider = {
  async listRuns() {
    await sleep();
    return [...store.state.runs];
  },

  async getAvailability() {
    await sleep();
    const a = store.state.availability;
    return {
      datasets: [...a.datasets],
      datasetSnapshots: { ...a.datasetSnapshots },
      environments: [...a.environments],
      agents: [...a.agents],
    };
  },

  async getInitialScene() {
    await sleep();
    const scene = store.state.scene;
    if (!scene) return null;
    return {
      initialStage: scene.initialStage as BacktestStage | undefined,
      initialRecipe: scene.initialRecipe as BacktestRecipe | undefined,
      divergences: scene.divergences ? [...scene.divergences] : undefined,
      metrics: scene.metrics ? [...scene.metrics] : undefined,
    };
  },

  subscribe(handler) {
    return store.subscribe(handler);
  },

  reset(seedId) {
    store.replace(() => buildState(seedId));
    emitRunsChanged();
  },
};
