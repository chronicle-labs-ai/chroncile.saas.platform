import { DashboardViewportShell, DatasetsManager } from "ui";

/*
 * /dashboard/datasets
 *
 * Renders the customer-facing Datasets surface — list/grid of
 * datasets with the in-component drill into a single dataset's
 * detail page (Overview / Traces / Clusters / Graph / Timeline).
 *
 * `DatasetsManager` is a `"use client"` component that owns selection,
 * filter, view, CRUD-dialog and trace-drawer state internally. This
 * route is a thin server-component wrapper to match the established
 * dashboard pattern (see `/dashboard`, `/dashboard/connections`,
 * `/dashboard/timeline`).
 *
 * The wrapper pins the page to exactly the viewport space available
 * inside the dashboard shell — `100svh` minus the site header (the
 * `--header-height` CSS variable on `dashboard/layout.tsx`) and the
 * layout's vertical `p-4` (2rem). With a fixed height, the detail
 * page's tabs and embedded `StreamTimelineViewer` / canvas graph
 * can do their internal scrolling correctly; without it the page
 * would otherwise grow past the viewport whenever the manager
 * switches into detail view with a long Traces or Clusters tab.
 *
 * Seed data is sourced from the design system today. When the Rust
 * backend exposes paginated endpoints for datasets + their trace
 * memberships, fetch from `server/backend/fetch-from-backend.ts`
 * here and pass `datasets` / `snapshotsById` props down. CRUD
 * handlers (`onCreateDataset`, `onUpdateDataset`, `onDeleteDataset`,
 * `onAddTraceToDataset`, `onRemoveTraceFromDataset`) are already
 * wired through `DatasetsManager`'s API for the same drop-in pattern.
 */
export default function DatasetsPage() {
  return (
    <DashboardViewportShell>
      <DatasetsManager />
    </DashboardViewportShell>
  );
}
