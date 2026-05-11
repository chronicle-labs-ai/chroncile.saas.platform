/*
 * Mock datasets provider.
 *
 * Wraps a `MockStore` seeded from `packages/seeds/datasets`.
 * Implements the full CRUD surface the manager hand-rolls today
 * (see `DatasetsManager`'s in-component overlays); mutations apply
 * in-place and emit events so React Query consumers re-render.
 *
 * Reset semantics mirror the agents impl: `reset(seedId)` swaps to
 * a different scenario without re-mounting consumers.
 */

import {
  resolveDatasetsSeed,
  type DatasetsSeedData,
} from "seeds/datasets";
import type {
  CreateDatasetPayload,
  Dataset,
  DatasetEvalRun,
  DatasetSavedView,
  DatasetSnapshot,
  TraceSummary,
  UpdateDatasetPayload,
  UpdateTracesPayload,
} from "ui";

import { getDataConfig } from "../config";
import { ProviderError } from "../types";
import { MockStore } from "../shared/mock-store";
import { sleep } from "../shared/latency";
import type {
  DatasetsEvent,
  ResettableDatasetsProvider,
} from "./types";

interface State {
  datasets: Map<string, Dataset>;
  snapshots: Map<string, DatasetSnapshot>;
  savedViews: Map<string, DatasetSavedView[]>;
  evalRuns: Map<string, DatasetEvalRun[]>;
}

function buildState(seedId?: string): State {
  const id = seedId ?? getDataConfig().seeds.datasets;
  const seed = resolveDatasetsSeed(id).build();
  return seedToState(seed);
}

function seedToState(seed: DatasetsSeedData): State {
  return {
    datasets: new Map(seed.datasets.map((d) => [d.id, { ...d }])),
    snapshots: new Map(
      Object.entries(seed.snapshotsById).map(([k, v]) => [k, { ...v }]),
    ),
    savedViews: new Map(),
    evalRuns: new Map(),
  };
}

const store = new MockStore<State, DatasetsEvent>(() => buildState());

function emitListChanged() {
  store.emit({
    kind: "list-changed",
    datasets: [...store.state.datasets.values()],
  });
}

function emitSnapshotChanged(datasetId: string, snapshot: DatasetSnapshot) {
  store.state.snapshots.set(datasetId, snapshot);
  store.emit({ kind: "snapshot-changed", datasetId, snapshot });
}

function generateId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function applyTracePatch(
  trace: TraceSummary,
  patch: UpdateTracesPayload["patch"],
): TraceSummary {
  const next: TraceSummary = { ...trace };
  if ("clusterId" in patch) {
    if (patch.clusterId === null) {
      delete (next as Partial<TraceSummary>).clusterId;
    } else if (patch.clusterId !== undefined) {
      next.clusterId = patch.clusterId;
    }
  }
  if ("split" in patch) {
    if (patch.split === null) {
      delete (next as Partial<TraceSummary>).split;
    } else if (patch.split !== undefined) {
      next.split = patch.split;
    }
  }
  if (patch.status !== undefined) {
    next.status = patch.status;
  }
  if ("note" in patch) {
    if (patch.note === null) {
      delete (next as Partial<TraceSummary>).note;
    } else if (patch.note !== undefined) {
      next.note = patch.note;
    }
  }
  return next;
}

export const mockDatasetsProvider: ResettableDatasetsProvider = {
  async list() {
    await sleep();
    return [...store.state.datasets.values()];
  },

  async getSnapshot(id) {
    await sleep();
    const snap = store.state.snapshots.get(id);
    if (!snap) return null;
    /* Re-bind the live `Dataset` so list edits flow into the
       detail page without an extra refetch. */
    const dataset = store.state.datasets.get(id);
    return dataset ? { ...snap, dataset } : snap;
  },

  async listSnapshots() {
    await sleep();
    const out: Record<string, DatasetSnapshot> = {};
    for (const [id, snap] of store.state.snapshots) {
      const dataset = store.state.datasets.get(id);
      out[id] = dataset ? { ...snap, dataset } : snap;
    }
    return out;
  },

  async create(payload: CreateDatasetPayload) {
    await sleep();
    const id = generateId("ds");
    const now = new Date().toISOString();
    const dataset: Dataset = {
      id,
      name: payload.name,
      description: payload.description,
      purpose: payload.purpose,
      traceCount: 0,
      eventCount: 0,
      updatedAt: now,
      createdBy: "you",
      tags: payload.tags ? [...payload.tags] : [],
    };
    store.state.datasets.set(id, dataset);
    store.state.snapshots.set(id, {
      dataset,
      traces: [],
      clusters: [],
      edges: [],
      events: [],
    });
    emitListChanged();
    return dataset;
  },

  async update({ id, patch }: UpdateDatasetPayload) {
    await sleep();
    const cur = store.state.datasets.get(id);
    if (!cur) {
      throw new ProviderError(404, `dataset ${id} not found`);
    }
    const next: Dataset = {
      ...cur,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    store.state.datasets.set(id, next);
    const snap = store.state.snapshots.get(id);
    if (snap) {
      emitSnapshotChanged(id, { ...snap, dataset: next });
    }
    emitListChanged();
    return next;
  },

  async remove(id) {
    await sleep();
    if (!store.state.datasets.has(id)) {
      throw new ProviderError(404, `dataset ${id} not found`);
    }
    store.state.datasets.delete(id);
    store.state.snapshots.delete(id);
    store.state.savedViews.delete(id);
    store.state.evalRuns.delete(id);
    emitListChanged();
  },

  async updateTraces({
    datasetId,
    traceIds,
    patch,
  }: UpdateTracesPayload) {
    await sleep();
    const snap = store.state.snapshots.get(datasetId);
    if (!snap) {
      throw new ProviderError(404, `dataset ${datasetId} not found`);
    }
    const ids = new Set(traceIds);
    const traces = snap.traces.map((t) =>
      ids.has(t.traceId) ? applyTracePatch(t, patch) : t,
    );
    const next: DatasetSnapshot = { ...snap, traces };
    emitSnapshotChanged(datasetId, next);
    return next;
  },

  async listSavedViews(datasetId) {
    await sleep();
    return store.state.savedViews.get(datasetId) ?? [];
  },

  async listEvalRuns(datasetId) {
    await sleep();
    return store.state.evalRuns.get(datasetId) ?? [];
  },

  subscribe(handler) {
    return store.subscribe(handler);
  },

  reset(seedId) {
    store.replace(() => buildState(seedId));
    emitListChanged();
  },
};
