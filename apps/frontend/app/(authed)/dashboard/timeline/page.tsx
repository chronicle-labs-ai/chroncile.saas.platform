import { DashboardViewportShell } from "ui";

import { TimelineDashboardClient } from "./timeline-client";

/*
 * /dashboard/timeline
 *
 * Renders the customer-facing event timeline. The
 * `TimelineDashboardClient` component pulls events + datasets from
 * the data middleware (mock / app / chronicle) and feeds them into
 * the design-system `<TimelineDashboard />`. Live updates ride the
 * provider's subscription bridge — no per-page subscribe call.
 *
 * The wrapper pins the page to exactly the viewport space available
 * inside the dashboard shell — `100svh` minus the site header (the
 * `--header-height` CSS variable on `dashboard/layout.tsx`) and the
 * layout's vertical `p-4` (2rem). With a fixed height, the
 * timeline's internal `overflow-hidden` + per-section scroll regions
 * can do their job; without it the page would otherwise grow past
 * the viewport whenever the rows list is long.
 */
export default function TimelineDashboardPage() {
  return (
    <DashboardViewportShell>
      <TimelineDashboardClient />
    </DashboardViewportShell>
  );
}
