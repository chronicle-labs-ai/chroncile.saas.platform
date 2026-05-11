/*
 * Mock timeline provider — backed by a `MockStore` seeded from
 * `packages/seeds/timeline`. The store holds the current event
 * window and the resolved dataset registry; mutations broadcast
 * `TimelineEvent`s the bridge translates into cache updates.
 *
 * Live behaviour: a slow synthetic stream (one event every 6–12
 * seconds while at least one consumer is subscribed) keeps the
 * viewer's playhead from running off the end of static data. Each
 * synthesized event borrows a (source, type) pair from the seed so
 * the row layout stays coherent.
 *
 * `reset(seedId)` swaps to a different scenario without re-mount —
 * `?seed.timeline=support-flow` flips the URL override and the
 * provider rebuilds in place.
 */

import { resolveTimelineSeed, type TimelineSeedData } from "seeds/timeline";
import type { Dataset, StreamTimelineEvent } from "chronicle/types/datasets";

import { getDataConfig } from "../config";
import { MockStore } from "../shared/mock-store";
import { sleep } from "../shared/latency";
import type {
  ResettableTimelineProvider,
  TimelineEvent,
  TimelineWindowQuery,
  TimelineWindowResponse,
} from "./types";

interface State {
  events: StreamTimelineEvent[];
  datasets: Dataset[];
  /** Anchors the synthetic stream so successive synthesized events
   *  flow from "now" forward, not from the seed's frozen anchor. */
  syntheticStartedAtMs: number;
  syntheticIndex: number;
}

function buildState(seedId?: string): State {
  const id = seedId ?? getDataConfig().seeds.timeline;
  const seed = resolveTimelineSeed(id).build();
  return seedToState(seed);
}

function seedToState(seed: TimelineSeedData): State {
  return {
    events: [...seed.events] as StreamTimelineEvent[],
    datasets: [...seed.datasets] as Dataset[],
    syntheticStartedAtMs: Date.now(),
    syntheticIndex: 0,
  };
}

const store = new MockStore<State, TimelineEvent>(() => buildState());

/* ── Synthetic stream loop ───────────────────────────────── */

let streamTimer: ReturnType<typeof setTimeout> | null = null;
let streamSubscriberCount = 0;

function pickSyntheticTemplate():
  | { source: string; type: string; message?: string }
  | null {
  const corpus = store.state.events;
  if (corpus.length === 0) return null;
  /* Prefer rows that look like recurring webhook traffic (an `id`
     starting with `bg_` in the support-flow seed, or any non-trace
     event in the default seed). */
  const candidates = corpus.filter(
    (e) => !e.traceId || e.id.startsWith("bg_"),
  );
  const pool = candidates.length > 0 ? candidates : corpus;
  const tpl = pool[Math.floor(Math.random() * pool.length)];
  return { source: tpl.source, type: tpl.type, message: tpl.message };
}

function scheduleNextSynthetic() {
  /* 6–12s jitter — slow enough that real streams feel busier, fast
     enough that a viewer left open notices new rows. */
  const delayMs = 6_000 + Math.floor(Math.random() * 6_000);
  streamTimer = setTimeout(() => {
    if (streamSubscriberCount === 0) {
      streamTimer = null;
      return;
    }
    const tpl = pickSyntheticTemplate();
    if (tpl) {
      const idx = store.state.syntheticIndex++;
      const synthetic: StreamTimelineEvent = {
        id: `synthetic_${Date.now().toString(36)}_${idx}`,
        source: tpl.source,
        type: tpl.type,
        occurredAt: new Date().toISOString(),
        message: tpl.message ?? `${tpl.type} (live)`,
      };
      store.state.events = [...store.state.events, synthetic];
      store.emit({ kind: "appended", event: synthetic });
    } else {
      store.emit({ kind: "heartbeat", occurredAt: new Date().toISOString() });
    }
    scheduleNextSynthetic();
  }, delayMs);
}

function ensureStreamRunning() {
  if (streamTimer !== null) return;
  scheduleNextSynthetic();
}

function stopStreamIfIdle() {
  if (streamSubscriberCount > 0) return;
  if (streamTimer !== null) {
    clearTimeout(streamTimer);
    streamTimer = null;
  }
}

/* ── Helpers ────────────────────────────────────────────── */

function applyWindow(
  events: readonly StreamTimelineEvent[],
  query: TimelineWindowQuery | undefined,
): TimelineWindowResponse {
  const limit = Math.max(1, Math.min(query?.limit ?? 200, 1000));
  const fromMs = query?.from ? Date.parse(query.from) : null;
  const toMs = query?.to ? Date.parse(query.to) : null;
  const filtered = events.filter((e) => {
    const t = Date.parse(e.occurredAt);
    if (fromMs !== null && t < fromMs) return false;
    if (toMs !== null && t > toMs) return false;
    return true;
  });
  filtered.sort(
    (a, b) =>
      Date.parse(a.occurredAt) - Date.parse(b.occurredAt),
  );
  const truncated = filtered.length > limit ? filtered.slice(-limit) : filtered;
  return {
    events: truncated,
    from: query?.from,
    to: query?.to,
    hasMore: filtered.length > limit,
    totalCount: filtered.length,
  };
}

/* ── Provider ────────────────────────────────────────────── */

export const mockTimelineProvider: ResettableTimelineProvider = {
  async list(query) {
    await sleep();
    return applyWindow(store.state.events, query);
  },

  async listDatasets() {
    await sleep();
    return [...store.state.datasets];
  },

  subscribe(handler) {
    streamSubscriberCount += 1;
    /* Replay the current window first so a late mount doesn't
       render empty. */
    handler({
      kind: "snapshot",
      events: [...store.state.events],
      occurredAt: new Date().toISOString(),
    });
    const sub = store.subscribe(handler);
    ensureStreamRunning();
    return {
      unsubscribe: () => {
        sub.unsubscribe();
        streamSubscriberCount = Math.max(0, streamSubscriberCount - 1);
        stopStreamIfIdle();
      },
    };
  },

  reset(seedId) {
    store.replace(() => buildState(seedId));
    store.emit({
      kind: "snapshot",
      events: [...store.state.events],
      occurredAt: new Date().toISOString(),
    });
  },
};
