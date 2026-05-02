import { BacktestsManager } from "ui";

/*
 * /dashboard/backtests
 *
 * Renders the customer-facing Backtests / Replay surface — a 3-stage
 * flow (Configure → Running → Results) for testing agent versions
 * against production traces, generated scenarios, or a saved
 * dataset.
 *
 * `BacktestsManager` is a `"use client"` component that owns the
 * stage state machine, the active recipe, and all editor / drawer
 * state internally. This route is a thin server-component wrapper
 * to match the established dashboard pattern (see
 * `/dashboard/connections`, `/dashboard/datasets`,
 * `/dashboard/timeline`).
 *
 * The wrapper pins the page to exactly the viewport space available
 * inside the dashboard shell — `100svh` minus the site header (the
 * `--header-height` CSS variable on `dashboard/layout.tsx`) and the
 * layout's vertical `p-4` (2rem). With a fixed height, the manager's
 * own top nav stays anchored and the stage body owns its scroll —
 * the live trace feed in Running and the divergences list in
 * Results would otherwise grow past the viewport.
 *
 * Seed data is sourced from the design system today. When the Rust
 * backend exposes endpoints for runs / recipes / divergences /
 * metrics, fetch from `server/backend/fetch-from-backend.ts` here
 * and pass `initialRecipe` / `divergences` / `metrics` props down.
 * Mutation slots (`onLaunch`, `onFinish`, `onPromote`) are already
 * wired through the manager's API for the same drop-in pattern.
 */
export default function BacktestsPage() {
  return (
    <div
      className="flex min-h-0 flex-col"
      style={{
        height: "calc(100svh - var(--header-height, 3.5rem) - 2rem)",
      }}
    >
      <BacktestsManager />
    </div>
  );
}
