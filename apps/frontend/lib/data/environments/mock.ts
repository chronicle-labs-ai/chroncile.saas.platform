/*
 * Mock environments provider — backed by a `MockStore` seeded from
 * `packages/seeds/environments`. No catalog mutations today
 * (start/stop/exec/stats live on `/api/sandbox/*`), so `subscribe`
 * only fans `list-changed` events from `reset(seedId)` swaps.
 */

import {
  resolveEnvironmentsSeed,
  type EnvironmentsSeedData,
} from "seeds/environments";
import type { SandboxEnvironment } from "ui";

import { getDataConfig } from "../config";
import { sleep } from "../shared/latency";
import { MockStore } from "../shared/mock-store";
import type {
  EnvironmentsEvent,
  ResettableEnvironmentsProvider,
} from "./types";

interface State {
  environments: SandboxEnvironment[];
}

function buildState(seedId?: string): State {
  const id = seedId ?? getDataConfig().seeds.environments;
  const seed = resolveEnvironmentsSeed(id).build();
  return seedToState(seed);
}

function seedToState(seed: EnvironmentsSeedData): State {
  return {
    environments: [...seed.environments] as SandboxEnvironment[],
  };
}

const store = new MockStore<State, EnvironmentsEvent>(() => buildState());

function emitListChanged() {
  store.emit({
    kind: "list-changed",
    environments: [...store.state.environments],
  });
}

export const mockEnvironmentsProvider: ResettableEnvironmentsProvider = {
  async list() {
    await sleep();
    return [...store.state.environments];
  },

  subscribe(handler) {
    return store.subscribe(handler);
  },

  reset(seedId) {
    store.replace(() => buildState(seedId));
    emitListChanged();
  },
};
