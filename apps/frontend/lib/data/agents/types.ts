/*
 * Agents provider interface + event shape.
 *
 * Every impl (`mock`, `app`, `chronicle`) satisfies the same
 * contract. Mutations may be async; subscribe is synchronous and
 * its handler is fanned out by the `subscribe-bridge` into the
 * React Query cache.
 */

import type {
  AgentSnapshot,
  AgentSummary,
  HashDomain,
  HashIndexEntry,
} from "ui";

import type { Subscription } from "../types";

export type AgentsEvent =
  | { kind: "list-changed"; agents: readonly AgentSummary[] }
  | { kind: "snapshot-changed"; name: string; snapshot: AgentSnapshot };

export interface AgentsProvider {
  list(): Promise<readonly AgentSummary[]>;
  getSnapshot(name: string): Promise<AgentSnapshot | null>;
  searchHashIndex(
    query: string,
    domains?: readonly HashDomain[],
  ): Promise<readonly HashIndexEntry[]>;
  pinLatest(name: string): Promise<AgentSummary>;
  subscribe(handler: (event: AgentsEvent) => void): Subscription;
}

export interface ResettableAgentsProvider extends AgentsProvider {
  /** Mock-only: swap to a different scenario seed without re-mount. */
  reset?: (seedId?: string) => void;
}
