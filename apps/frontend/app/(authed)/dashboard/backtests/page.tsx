"use client";

import { BacktestsManager, DashboardViewportShell } from "ui";

import {
  useBacktestsAvailability,
  useBacktestsRuns,
  useBacktestsScene,
} from "@/lib/data/backtests";

/*
 * /dashboard/backtests
 *
 * Renders the customer-facing Backtests / Replay surface — a 4-stage
 * flow (List → Configure → Running → Results).
 *
 * This page is now a thin `"use client"` wrapper over the backtests
 * data middleware (`@/lib/data/backtests`). Three React Query hooks
 * feed `BacktestsManager`:
 *
 *   - `useBacktestsRuns()`         — list rows
 *   - `useBacktestsAvailability()` — Configure pickers (datasets,
 *                                    snapshots, environments, agents)
 *   - `useBacktestsScene()`        — optional pre-baked Results entry
 *
 * Most seeds (`default`, `empty`, `support-flow`) leave `scene`
 * `null` so the manager lands on its list view. The `chronicle-demo`
 * seed pre-bakes a completed Run that lands directly on Results so
 * the demo's failure-reveal beat (script 2:05 - 2:35) renders
 * without click-through.
 *
 * Every prop on `BacktestsManager` is optional with internal
 * fallbacks, so the manager renders cleanly during the brief moment
 * before queries resolve. Wire to the backend run registry by flipping
 * `NEXT_PUBLIC_DATA_BACKTESTS` from `mock` to `app` / `chronicle`
 * once those impls land.
 */
export default function BacktestsPage() {
  const runsQuery = useBacktestsRuns();
  const availabilityQuery = useBacktestsAvailability();
  const sceneQuery = useBacktestsScene();

  const availability = availabilityQuery.data;
  const scene = sceneQuery.data;

  return (
    <DashboardViewportShell>
      <BacktestsManager
        runs={runsQuery.data}
        availableDatasets={availability?.datasets}
        availableDatasetSnapshots={availability?.datasetSnapshots}
        availableEnvironments={availability?.environments}
        availableAgents={availability?.agents}
        initialStage={scene?.initialStage}
        initialRecipe={scene?.initialRecipe ?? null}
        divergences={scene?.divergences}
        metrics={scene?.metrics}
      />
    </DashboardViewportShell>
  );
}
