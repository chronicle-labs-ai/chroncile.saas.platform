/*
 * Connections — dashboard-context surfaces for managing existing
 * connections. Mirrors the `connectors/` (per-source modals) and
 * `onboarding/` (first-run flow) modules but covers the post-install,
 * "Settings → Connections" surface area: list/grid view, detail
 * drawer + page, scope editor, secret rotate, backfill history,
 * activity log, event-type subscriptions.
 */

/* ── Top-level surface ───────────────────────────────────── */
export { ConnectionsManager } from "./connections-manager";
export type { ConnectionsManagerProps } from "./connections-manager";

/* ── Atoms ───────────────────────────────────────────────── */
export { ConnectionHealthBadge } from "./connection-health-badge";
export type { ConnectionHealthBadgeProps } from "./connection-health-badge";

export { ConnectionRow, CONNECTION_ROW_GRID_TEMPLATE } from "./connection-row";
export type { ConnectionRowProps } from "./connection-row";

export { ConnectionCard } from "./connection-card";
export type { ConnectionCardProps } from "./connection-card";

export { ConnectionActionsMenu } from "./connection-actions-menu";
export type { ConnectionActionsMenuProps } from "./connection-actions-menu";

export { ConnectionsToolbar } from "./connections-toolbar";
export type {
  ConnectionsToolbarProps,
  ConnectionsView,
} from "./connections-toolbar";

export { ConnectionEmpty } from "./connection-empty";
export type { ConnectionEmptyProps } from "./connection-empty";

/* ── Detail surfaces ─────────────────────────────────────── */
export {
  ConnectionDetailBody,
  CONNECTION_DETAIL_TABS,
  CONNECTION_DRAWER_TABS,
} from "./connection-detail-body";
export type {
  ConnectionDetailBodyProps,
  ConnectionDetailTab,
} from "./connection-detail-body";

export { ConnectionDetailDrawer } from "./connection-detail-drawer";
export type { ConnectionDetailDrawerProps } from "./connection-detail-drawer";

export { ConnectionDetailPage } from "./connection-detail-page";
export type { ConnectionDetailPageProps } from "./connection-detail-page";

/* ── Add-connection picker ───────────────────────────────── */
export { AddConnectionPicker } from "./add-connection-picker";
export type { AddConnectionPickerProps } from "./add-connection-picker";

/* ── Hydration-safe time / number helpers ────────────────── */
export {
  RelativeTime,
  useMounted,
  formatRelative,
  formatStableDate,
  formatStableTime,
  formatStableDateTime,
  formatNumber,
} from "./time";
export type { RelativeTimeProps } from "./time";

/* ── Data + types ────────────────────────────────────────── */
export {
  connectionsSeed,
  connectionBackfillsSeed,
  connectionDeliveriesSeed,
  connectionEventSubsSeed,
  CONNECTION_HEALTH_FILTERS,
  getConnection,
} from "./data";
export type {
  Connection,
  ConnectionHealth,
  ConnectionBackfillRecord,
  ConnectionEventTypeSub,
  ConnectionDelivery,
} from "./data";
