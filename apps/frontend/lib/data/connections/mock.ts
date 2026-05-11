/*
 * Mock connections provider — backed by a `MockStore` seeded from
 * `packages/seeds/connections`. Mutations apply in-place and emit
 * `ConnectionsEvent`s so the React Query cache sees changes
 * immediately.
 *
 * `reset(seedId)` swaps to a different scenario without re-mount.
 * Uses `?seed.connections=empty` to exercise the empty-state surface.
 */

import { resolveConnectionsSeed, type ConnectionsSeedData } from "seeds/connections";
import type {
  Connection,
  ConnectionBackfillRecord,
  ConnectionDelivery,
  ConnectionEventTypeSub,
  ConnectionHealth,
} from "chronicle/types/connections";

import { getDataConfig } from "../config";
import { MockStore } from "../shared/mock-store";
import { sleep } from "../shared/latency";
import { ProviderError } from "../types";
import type {
  ConnectionsEvent,
  ResettableConnectionsProvider,
} from "./types";

interface State {
  connections: Connection[];
  backfillsByConnection: Record<string, ConnectionBackfillRecord[]>;
  deliveriesByConnection: Record<string, ConnectionDelivery[]>;
  eventSubsByConnection: Record<string, ConnectionEventTypeSub[]>;
}

function buildState(seedId?: string): State {
  const id = seedId ?? getDataConfig().seeds.connections;
  const seed = resolveConnectionsSeed(id).build();
  return seedToState(seed);
}

function seedToState(seed: ConnectionsSeedData): State {
  return {
    connections: [...seed.connections] as Connection[],
    backfillsByConnection: {
      ...(seed.backfillsByConnection as Record<
        string,
        ConnectionBackfillRecord[]
      >),
    },
    deliveriesByConnection: {
      ...(seed.deliveriesByConnection as Record<string, ConnectionDelivery[]>),
    },
    eventSubsByConnection: {
      ...(seed.eventSubsByConnection as Record<
        string,
        ConnectionEventTypeSub[]
      >),
    },
  };
}

const store = new MockStore<State, ConnectionsEvent>(() => buildState());

function emitListChanged() {
  store.emit({
    kind: "list-changed",
    connections: [...store.state.connections],
  });
}

function patchRow(id: string, patch: Partial<Connection>): Connection {
  const idx = store.state.connections.findIndex((c) => c.id === id);
  if (idx === -1) {
    throw new ProviderError(404, `connection ${id} not found`);
  }
  const next: Connection = { ...store.state.connections[idx], ...patch };
  store.state.connections[idx] = next;
  store.emit({ kind: "row-patched", patch: { id, ...patch } });
  return next;
}

const NOW_ISO = () => new Date().toISOString();

export const mockConnectionsProvider: ResettableConnectionsProvider = {
  async list() {
    await sleep();
    return [...store.state.connections];
  },

  async listBackfills() {
    await sleep();
    return { ...store.state.backfillsByConnection };
  },

  async listDeliveries() {
    await sleep();
    return { ...store.state.deliveriesByConnection };
  },

  async listEventSubs() {
    await sleep();
    return { ...store.state.eventSubsByConnection };
  },

  async pause(id) {
    await sleep();
    return patchRow(id, { health: "paused" satisfies ConnectionHealth });
  },

  async resume(id) {
    await sleep();
    return patchRow(id, { health: "live" satisfies ConnectionHealth });
  },

  async test(id) {
    await sleep();
    /* The manager renders a brief `pending` state while the mock
       resolves; we settle as a successful test for predictability. */
    return patchRow(id, {
      health: "live" satisfies ConnectionHealth,
      lastTestedAt: NOW_ISO(),
      lastTestStatus: "ok",
    });
  },

  async reauth(id) {
    await sleep();
    return patchRow(id, { health: "live" satisfies ConnectionHealth });
  },

  async rotateSecret(id) {
    await sleep();
    /* Secret rotation is a no-op against the wire shape — the
       drawer expects the same row back so `useMutation` finishes
       its pending state. */
    return patchRow(id, {});
  },

  async runBackfill(id) {
    await sleep();
    const list = store.state.backfillsByConnection[id] ?? [];
    const record: ConnectionBackfillRecord = {
      id: `bf_${Math.random().toString(36).slice(2, 8)}`,
      windowDays: 7,
      entities: ["all"],
      estEvents: 0,
      startedAt: NOW_ISO(),
      status: "running",
    };
    store.state.backfillsByConnection[id] = [record, ...list];
    return patchRow(id, {});
  },

  async disconnect(id) {
    await sleep();
    const before = store.state.connections.length;
    store.state.connections = store.state.connections.filter(
      (c) => c.id !== id,
    );
    if (store.state.connections.length === before) {
      throw new ProviderError(404, `connection ${id} not found`);
    }
    delete store.state.backfillsByConnection[id];
    delete store.state.deliveriesByConnection[id];
    delete store.state.eventSubsByConnection[id];
    emitListChanged();
  },

  subscribe(handler) {
    return store.subscribe(handler);
  },

  reset(seedId) {
    store.replace(() => buildState(seedId));
    emitListChanged();
  },
};
