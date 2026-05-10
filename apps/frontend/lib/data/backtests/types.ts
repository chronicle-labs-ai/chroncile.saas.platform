/*
 * Backtests provider interface + event shape.
 *
 * Every impl (`mock`, `app`, `chronicle`) satisfies the same
 * contract. Backtests has no real-time mutations today — `subscribe`
 * is a no-op for now; when the Rust backend ships an SSE stream for
 * run progress, plug it in here the same way agents does.
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

import type { Subscription } from "../types";

export interface BacktestsAvailability {
  datasets: readonly Dataset[];
  datasetSnapshots: Readonly<Record<string, DatasetSnapshot>>;
  environments: readonly SandboxEnvironment[];
  agents: readonly AgentSummary[];
}

export interface BacktestsScene {
  initialStage?: BacktestStage;
  initialRecipe?: BacktestRecipe;
  divergences?: readonly BacktestDivergence[];
  metrics?: readonly BacktestMetric[];
}

export type BacktestsEvent =
  | { kind: "runs-changed"; runs: readonly BacktestRunSummary[] };

export interface BacktestsProvider {
  listRuns(): Promise<readonly BacktestRunSummary[]>;
  getAvailability(): Promise<BacktestsAvailability>;
  /** Returns `null` when the seed has no pre-baked Results scene —
   *  the route falls back to the list view. */
  getInitialScene(): Promise<BacktestsScene | null>;
  subscribe(handler: (event: BacktestsEvent) => void): Subscription;
}

export interface ResettableBacktestsProvider extends BacktestsProvider {
  /** Mock-only: swap to a different scenario seed without re-mount. */
  reset?: (seedId?: string) => void;
}
