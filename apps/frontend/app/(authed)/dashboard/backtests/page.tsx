import {
  BacktestsManager,
  DashboardViewportShell,
  agentsManagerSeed,
  datasetsSeed,
  environmentsSeed,
} from "ui";

/*
 * /dashboard/backtests
 *
 * Renders the customer-facing Backtests / Replay surface — a 3-stage
 * flow (Configure → Running → Results) for testing agent versions
 * against production traces, generated scenarios, or a saved
 * dataset.
 *
 * Configure is now a directional pipeline:
 *
 *   01 Dataset → 02 Discover gaps → 03 Environment → 04 Versions
 *
 * The Replay preset auto-skips step 02. Each step bridges to a real
 * primitive: datasets reuse `Dataset` shapes from the design system
 * seeds, environments reuse `SandboxEnvironment`, versions reuse
 * `AgentSummary`. When the Rust backend exposes registries for any
 * of these, swap the seeds for live data.
 *
 * `BacktestsManager` is a `"use client"` component that owns the
 * stage state machine, the active recipe, and all editor / drawer
 * state internally. This route is a thin server-component wrapper
 * to match the established dashboard pattern.
 *
 * The wrapper pins the page to exactly the viewport space available
 * inside the dashboard shell — `100svh` minus the site header (the
 * `--header-height` CSS variable on `dashboard/layout.tsx`) and the
 * layout's vertical `p-4` (2rem). With a fixed height, the manager's
 * own top nav stays anchored and the stage body owns its scroll —
 * the live trace feed in Running and the divergences list in
 * Results would otherwise grow past the viewport.
 */
export default function BacktestsPage() {
  return (
    <DashboardViewportShell>
      <BacktestsManager
        availableDatasets={datasetsSeed}
        availableEnvironments={environmentsSeed}
        availableAgents={agentsManagerSeed}
      />
    </DashboardViewportShell>
  );
}
