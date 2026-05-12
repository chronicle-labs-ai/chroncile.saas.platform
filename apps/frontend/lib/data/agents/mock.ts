/*
 * Mock agents provider — backed by a `MockStore` seeded from
 * `packages/seeds/agents`. Mutations (just `pinLatest` for now)
 * apply in-place and emit `AgentsEvent`s so the React Query cache
 * sees the change immediately.
 *
 * `reset(seedId)` swaps to a different scenario without re-mount —
 * used by the DevTools widget and by tests via `?seed.agents=empty`.
 */

import { resolveAgentsSeed, type AgentsSeedData } from "seeds/agents";
import type {
  AgentSnapshot,
  AgentSummary,
  HashDomain,
  HashIndexEntry,
} from "ui";

import { getDataConfig } from "../config";
import { MockStore } from "../shared/mock-store";
import { sleep } from "../shared/latency";
import type {
  AgentsEvent,
  ResettableAgentsProvider,
} from "./types";

interface State {
  summaries: AgentSummary[];
  snapshotsByName: Record<string, AgentSnapshot>;
  hashIndex: HashIndexEntry[];
}

function buildState(seedId?: string): State {
  const id = seedId ?? getDataConfig().seeds.agents;
  const seed = resolveAgentsSeed(id).build();
  return seedToState(seed);
}

function seedToState(seed: AgentsSeedData): State {
  return {
    summaries: [...seed.summaries] as AgentSummary[],
    snapshotsByName: { ...seed.snapshotsByName } as Record<string, AgentSnapshot>,
    hashIndex: [...seed.hashIndex] as HashIndexEntry[],
  };
}

const store = new MockStore<State, AgentsEvent>(() => buildState());

function emitListChanged() {
  store.emit({ kind: "list-changed", agents: [...store.state.summaries] });
}

function matchesHashIndexEntry(
  entry: HashIndexEntry,
  needle: string,
  domains: readonly HashDomain[],
): boolean {
  if (domains.length > 0 && !domains.includes(entry.kind)) return false;
  if (!needle) return true;
  const haystack = [
    entry.hash,
    entry.kind,
    entry.path,
    entry.artifactId ?? "",
    entry.runId ?? "",
    entry.preview ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

export const mockAgentsProvider: ResettableAgentsProvider = {
  async list() {
    await sleep();
    return [...store.state.summaries];
  },

  async getSnapshot(name) {
    await sleep();
    const snap = store.state.snapshotsByName[name];
    if (!snap) return null;
    /* Re-bind the freshly-loaded summary in case the manager
       reordered it (e.g. via pinLatest). */
    const summary =
      store.state.summaries.find((s) => s.name === name) ?? snap.summary;
    return { ...snap, summary };
  },

  async searchHashIndex(query, domains = []) {
    await sleep();
    const needle = query.trim().toLowerCase();
    return store.state.hashIndex.filter((e) =>
      matchesHashIndexEntry(e, needle, domains),
    );
  },

  async pinLatest(name) {
    await sleep();
    const idx = store.state.summaries.findIndex((s) => s.name === name);
    if (idx === -1) {
      throw new Error(`[mock-agents] agent "${name}" not found`);
    }
    /* Move the agent to the top of the list — mirrors the manager's
       local reorder behaviour so flipping `mock` ↔ `chronicle` looks
       identical to the user. */
    const [target] = store.state.summaries.splice(idx, 1);
    store.state.summaries.unshift(target);
    emitListChanged();
    return target;
  },

  subscribe(handler) {
    return store.subscribe(handler);
  },

  reset(seedId) {
    store.replace(() => buildState(seedId));
    emitListChanged();
  },
};
