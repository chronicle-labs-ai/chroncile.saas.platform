import { TimelineDashboard } from "ui";

/*
 * /dashboard/timeline
 *
 * Renders the customer-facing event timeline. The `TimelineDashboard`
 * client component owns playback / selection / filter / dataset
 * state; this route is a thin wrapper to match the established
 * dashboard pattern (see `/dashboard` and `/dashboard/connections`).
 *
 * The wrapper pins the page to exactly the viewport space available
 * inside the dashboard shell — `100svh` minus the site header (the
 * `--header-height` CSS variable on `dashboard/layout.tsx`) and the
 * layout's vertical `p-4` (2rem). With a fixed height, the
 * timeline's internal `overflow-hidden` + per-section scroll regions
 * can do their job; without it the page would otherwise grow past
 * the viewport whenever the rows list is long.
 *
 * Seed data is sourced from the design system today and re-anchored
 * to recent wall-clock time inside `TimelineDashboard`. When the
 * Rust backend exposes a paginated `/api/events` route that returns
 * `StreamTimelineEvent`-shaped rows, fetch from
 * `server/backend/fetch-from-backend.ts` here and pass `events` /
 * `initialDatasets` props down.
 */
export default function TimelineDashboardPage() {
  return (
    <div
      className="flex min-h-0 flex-col"
      style={{
        height:
          "calc(100svh - var(--header-height, 3.5rem) - 2rem)",
      }}
    >
      <TimelineDashboard />
    </div>
  );
}
