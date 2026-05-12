/*
 * Agents seed shape.
 *
 * The mock provider boots its `MockStore` from `AgentsSeedData`;
 * the `seed:chronicle` CLI consumes the same payload and POSTs
 * each entry to the Chronicle backend. Storybook decorators may
 * also build a snapshot off the registry to render against
 * non-default scenarios.
 */

import type {
  AgentSnapshot,
  AgentSummary,
  HashIndexEntry,
} from "ui";

import type { Seed } from "../types";

export interface AgentsSeedData {
  /** Manager-list rows. Order is preserved when rendered. */
  summaries: readonly AgentSummary[];
  /** Detail-page snapshots keyed by `summary.name`. */
  snapshotsByName: Readonly<Record<string, AgentSnapshot>>;
  /** Global cross-cutting hash index for the standalone Hash page. */
  hashIndex: readonly HashIndexEntry[];
}

export type AgentsSeed = Seed<AgentsSeedData>;
