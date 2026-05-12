/*
 * Connections provider interface + event shape.
 *
 * Mirrors the agents/datasets shape: read methods, mutation
 * handlers (pause/resume/test/etc), and a single `subscribe()` for
 * live updates over Chronicle SSE. The dashboard manager already
 * accepts these handler signatures so consumers drop the hooks in
 * directly.
 */

import type {
  Connection,
  ConnectionBackfillRecord,
  ConnectionDelivery,
  ConnectionEventTypeSub,
} from "chronicle/types/connections";

import type { Subscription } from "../types";

export type ConnectionsEvent =
  | { kind: "list-changed"; connections: readonly Connection[] }
  | { kind: "row-patched"; patch: Partial<Connection> & { id: string } };

export interface ConnectionsProvider {
  list(): Promise<readonly Connection[]>;

  /** Per-connection auxiliary lookups. Bulk + cached on the mock side
   *  so the manager can render its drawers without N+1 fetches. */
  listBackfills(): Promise<
    Readonly<Record<string, readonly ConnectionBackfillRecord[]>>
  >;
  listDeliveries(): Promise<
    Readonly<Record<string, readonly ConnectionDelivery[]>>
  >;
  listEventSubs(): Promise<
    Readonly<Record<string, readonly ConnectionEventTypeSub[]>>
  >;

  /* Action mutations. Each returns the patched row (or void for
     destructive ones) so the cache can `setQueryData` cleanly. */
  pause(id: string): Promise<Connection>;
  resume(id: string): Promise<Connection>;
  test(id: string): Promise<Connection>;
  reauth(id: string): Promise<Connection>;
  rotateSecret(id: string): Promise<Connection>;
  runBackfill(id: string): Promise<Connection>;
  disconnect(id: string): Promise<void>;

  subscribe(handler: (event: ConnectionsEvent) => void): Subscription;
}

export interface ResettableConnectionsProvider extends ConnectionsProvider {
  reset?: (seedId?: string) => void;
}
