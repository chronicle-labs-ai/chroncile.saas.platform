/*
 * Default agents seed — the canonical "5 realistic agents" workspace
 * already shipped by the design system. Phase A wraps the existing
 * `ui` exports unchanged; Phase B will eventually move the fixture
 * bodies here, but doing it in this PR would balloon the diff and
 * risk Storybook regressions.
 *
 * `build()` returns a fresh structuredClone so the `mock` provider
 * can mutate freely without poisoning the next boot. In dev mode it
 * also validates each cloned slice against the Zod schemas so a
 * fixture drift surfaces at first use.
 */

import {
  AgentSnapshotSchema,
  AgentSummarySchema,
  HashIndexEntrySchema,
} from "chronicle/schemas";
import type {
  AgentSnapshot,
  AgentSummary,
  HashIndexEntry,
} from "chronicle/types";
import {
  AGENTS_MOCK_ANCHOR_MS,
  agentsManagerSeed,
  agentSnapshotsByName,
  globalHashIndexSeed,
} from "ui";
import { z } from "zod";

import { validateInDev } from "../_validate";
import { rebaseTimestamps } from "../util";
import type { AgentsSeed, AgentsSeedData } from "./types";

const AgentSummaryListSchema = z.array(AgentSummarySchema);
const AgentSnapshotMapSchema = z.record(AgentSnapshotSchema);
const HashIndexEntryListSchema = z.array(HashIndexEntrySchema);

export const defaultAgentsSeed: AgentsSeed = {
  id: "default",
  label: "Realistic workspace",
  description: "5 agents · matches the design-system Storybook default",
  build(): AgentsSeedData {
    const summaries = structuredClone(agentsManagerSeed) as AgentSummary[];
    const snapshotsByName = structuredClone(
      agentSnapshotsByName,
    ) as Record<string, AgentSnapshot>;
    const hashIndex = structuredClone(globalHashIndexSeed) as HashIndexEntry[];

    validateInDev(
      AgentSummaryListSchema,
      summaries,
      "agents:default summaries",
    );
    validateInDev(
      AgentSnapshotMapSchema,
      snapshotsByName,
      "agents:default snapshotsByName",
    );
    validateInDev(
      HashIndexEntryListSchema,
      hashIndex,
      "agents:default hashIndex",
    );

    const data: AgentsSeedData = { summaries, snapshotsByName, hashIndex };
    return rebaseTimestamps(data, { sourceAnchorMs: AGENTS_MOCK_ANCHOR_MS });
  },
};
