/*
 * React hooks over the timeline provider.
 *
 * The dashboard's `<TimelineDashboard />` accepts `events` +
 * `initialDatasets` props; consumers wire those props from
 * `useTimelineWindow()` + `useTimelineDatasets()`. Live updates
 * flow through the subscription bridge (mounted globally by
 * `<DataProviderProvider>`) — each `appended` envelope appends to
 * the cached events array, so the UI updates automatically without
 * the page having to set up its own subscription.
 */

"use client";

import {
  useQuery,
  type UseQueryResult,
} from "@tanstack/react-query";

import type { Dataset, StreamTimelineEvent } from "chronicle/types/datasets";

import { useDataProvider } from "../provider";
import { qk } from "../query-keys";
import type {
  TimelineWindowQuery,
  TimelineWindowResponse,
} from "./types";

/**
 * Fetch a window of events. Defaults to the most recent ~200 events
 * with no time bounds, which matches the viewer's default zoom.
 */
export function useTimelineWindow(
  query?: TimelineWindowQuery,
): UseQueryResult<TimelineWindowResponse, Error> {
  const { timeline } = useDataProvider();
  return useQuery({
    queryKey: qk.timeline.window(query?.from, query?.to, query?.limit),
    queryFn: () => timeline.list(query),
  });
}

/**
 * Convenience wrapper that returns just the events array, with an
 * empty fallback. Keeps the dashboard call site terse — it only
 * needs the array to feed `<TimelineDashboard events>`.
 */
export function useTimelineEvents(
  query?: TimelineWindowQuery,
): readonly StreamTimelineEvent[] {
  const window = useTimelineWindow(query);
  return window.data?.events ?? [];
}

/**
 * Datasets surfaced in the detail-panel "Add to dataset" picker.
 * The timeline owns this list so a scenario flip (mock seed →
 * support-flow) updates both surfaces in lock-step.
 */
export function useTimelineDatasets(): UseQueryResult<
  readonly Dataset[],
  Error
> {
  const { timeline } = useDataProvider();
  return useQuery({
    queryKey: qk.timeline.datasets(),
    queryFn: () => timeline.listDatasets(),
  });
}
