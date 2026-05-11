/*
 * Timeline domain entrypoint. Mirror of agents/datasets/connections.
 *
 * The bridge maps `TimelineEvent`s onto the timeline window cache:
 *   - `snapshot`  — replace the events array entirely.
 *   - `appended`  — push the new event onto the array (sorted in
 *                   ascending occurredAt order so the viewer's row
 *                   layout stays predictable).
 *   - `heartbeat` — ignored; only updates the EventSource keepalive.
 */

import type { QueryClient } from "@tanstack/react-query";
import type { StreamTimelineEvent } from "chronicle/types/datasets";

import { getDataConfig } from "../config";
import { qk } from "../query-keys";
import { bridgeSubscription } from "../shared/subscribe-bridge";

import { mockTimelineProvider } from "./mock";
import { appTimelineProvider } from "./app";
import { chronicleTimelineProvider } from "./chronicle";
import type {
  ResettableTimelineProvider,
  TimelineEvent,
  TimelineProvider,
  TimelineWindowResponse,
} from "./types";

export type {
  ResettableTimelineProvider,
  TimelineEvent,
  TimelineProvider,
  TimelineWindowResponse,
};

export function createTimelineProvider(): TimelineProvider {
  switch (getDataConfig().timeline) {
    case "chronicle":
      return chronicleTimelineProvider;
    case "app":
      return appTimelineProvider;
    case "mock":
    default:
      return mockTimelineProvider;
  }
}

export function bridgeTimeline(
  client: QueryClient,
  provider: TimelineProvider,
): () => void {
  return bridgeSubscription<TimelineEvent>(client, {
    subscribe: (handler) => provider.subscribe(handler),
    reduce: (event, qc) => {
      if (event.kind === "snapshot") {
        /* Replace every cached window — different (from, to, limit)
           bindings can co-exist; the snapshot represents the
           server's current view of "recent", so blow them all out.
           Scoped to the window prefix so the sibling datasets
           cache (a `Dataset[]`, no `events` field) isn't touched. */
        qc.setQueriesData<TimelineWindowResponse>(
          { queryKey: qk.timeline.windowsAll },
          (old) =>
            old
              ? { ...old, events: [...event.events] }
              : { events: [...event.events], hasMore: false },
        );
      } else if (event.kind === "appended") {
        /* Append to every active window cache. The bridge is fanned
           in deliberately — the dashboard typically holds one
           query at a time, but the detail surface may pin a
           narrower range concurrently. */
        qc.setQueriesData<TimelineWindowResponse>(
          { queryKey: qk.timeline.windowsAll },
          (old) => {
            if (!old || !Array.isArray(old.events)) {
              return { events: [event.event], hasMore: false };
            }
            const next = [...old.events, event.event] as StreamTimelineEvent[];
            next.sort(
              (a, b) =>
                Date.parse(a.occurredAt) - Date.parse(b.occurredAt),
            );
            return { ...old, events: next };
          },
        );
      }
      /* heartbeats: no-op on the cache. */
    },
  });
}

export { useTimelineWindow, useTimelineEvents, useTimelineDatasets } from "./hooks";
