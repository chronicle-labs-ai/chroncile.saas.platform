/*
 * Connections seed shape — wraps the dashboard projection types
 * (NOT the saas DB-row).
 *
 * The mock provider boots its `MockStore` from `ConnectionsSeedData`;
 * the `seed:chronicle` CLI (when wired) consumes the same payload
 * and POSTs each entry. Storybook decorators may render the
 * manager against non-default scenarios.
 */

import type {
  Connection,
  ConnectionBackfillRecord,
  ConnectionDelivery,
  ConnectionEventTypeSub,
} from "chronicle/types/connections";

import type { Seed } from "../types";

export interface ConnectionsSeedData {
  /** Manager-list rows. Order is preserved when rendered. */
  connections: readonly Connection[];
  /** Per-connection backfill history, keyed by connection id. */
  backfillsByConnection: Readonly<
    Record<string, readonly ConnectionBackfillRecord[]>
  >;
  /** Per-connection recent deliveries. */
  deliveriesByConnection: Readonly<
    Record<string, readonly ConnectionDelivery[]>
  >;
  /** Per-connection event-type subscriptions. */
  eventSubsByConnection: Readonly<
    Record<string, readonly ConnectionEventTypeSub[]>
  >;
}

export type ConnectionsSeed = Seed<ConnectionsSeedData>;
