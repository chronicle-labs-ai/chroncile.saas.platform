"use client";

import * as React from "react";

import { cx } from "../utils/cx";
import {
  STREAM_TIMELINE_MOCK_ANCHOR_MS,
  StreamTimelineViewer,
  datasetsSeed,
  streamTimelineSeed,
  type AddTraceToDatasetPayload,
  type Dataset,
  type StreamPlaybackState,
  type StreamTimelineEvent,
  type StreamTimelineGroupBy,
  type TraceDatasetMembership,
} from "../stream-timeline";

/**
 * TimelineDashboard — composed `/dashboard/timeline` page surface.
 *
 * Wraps `StreamTimelineViewer` with all the feature surfaces wired:
 * filter rail, trace highlight + connector arcs, unified detail
 * sidebar with dataset CTA, and the dataset builder's add/membership
 * lifecycle. Designed to drop into a Next.js route as
 * `<TimelineDashboard />`; tests/stories can override `events` and
 * `datasets` to feed deterministic data.
 *
 * Re-anchors the curated `streamTimelineSeed` so the latest event
 * lands ~5 minutes before the current wall-clock time. That makes
 * the Live mode feel coherent and keeps the demo from looking
 * stranded in the past.
 */

export interface TimelineDashboardProps {
  /** Override the events shown — defaults to the rebased
   *  `streamTimelineSeed`. Useful for tests / docs. */
  events?: readonly StreamTimelineEvent[];
  /** Override the datasets the user can add traces to — defaults
   *  to `datasetsSeed`. */
  initialDatasets?: readonly Dataset[];
  /** Eyebrow text rendered in the toolbar's leading slot. */
  toolbarLeading?: React.ReactNode;
  /** Optional className on the outer container. */
  className?: string;
  /** Suppresses the timestamp re-anchoring — pass when you want the
   *  exact timestamps from the seed (deterministic for VRT). */
  disableRebase?: boolean;
}

/** Shift every event's timestamp so the latest one lands at `targetMs`. */
function rebaseEvents(
  events: readonly StreamTimelineEvent[],
  targetMs: number,
): StreamTimelineEvent[] {
  if (events.length === 0) return [];
  let latest = -Infinity;
  for (const e of events) {
    const t = new Date(e.occurredAt).getTime();
    if (t > latest) latest = t;
  }
  const offset = targetMs - latest;
  if (offset === 0) return [...events];
  return events.map((e) => ({
    ...e,
    occurredAt: new Date(
      new Date(e.occurredAt).getTime() + offset,
    ).toISOString(),
  }));
}

export function TimelineDashboard({
  events: eventsProp,
  initialDatasets,
  toolbarLeading,
  className,
  disableRebase = false,
}: TimelineDashboardProps = {}) {
  /* Capture a stable mount timestamp via lazy `useState` so re-anchor
     math stays idempotent across re-renders (calling `Date.now()`
     directly inside `useMemo` violates the hooks purity rule). */
  const [mountedAtMs] = React.useState(() => Date.now());

  /* Rebase the seed so the demo data feels current. Keep the
     caller-supplied events untouched (they own the timestamps). */
  const events = React.useMemo(() => {
    if (eventsProp) return eventsProp;
    if (disableRebase) return streamTimelineSeed;
    /* Anchor the latest event 5 minutes ago so the playhead has room
       to sweep forward before reaching "now". */
    return rebaseEvents(streamTimelineSeed, mountedAtMs - 5 * 60 * 1000);
  }, [eventsProp, disableRebase, mountedAtMs]);

  const initialCenterMs = React.useMemo(() => {
    if (eventsProp || disableRebase) {
      return STREAM_TIMELINE_MOCK_ANCHOR_MS - 15 * 60 * 1000;
    }
    return mountedAtMs - 15 * 60 * 1000;
  }, [eventsProp, disableRebase, mountedAtMs]);

  const [playback, setPlayback] =
    React.useState<StreamPlaybackState>("paused");
  const [selectedEventId, setSelectedEventId] =
    React.useState<string | null>(null);
  const [groupBy, setGroupBy] =
    React.useState<StreamTimelineGroupBy>("topic");

  const [datasets, setDatasets] = React.useState<Dataset[]>(() =>
    initialDatasets ? [...initialDatasets] : [...datasetsSeed],
  );
  const [memberships, setMemberships] = React.useState<
    Map<string, TraceDatasetMembership[]>
  >(() => new Map());

  const handleAddTraceToDataset = React.useCallback(
    async (payload: AddTraceToDatasetPayload) => {
      // Simulate a 350ms network round-trip so the picker can show
      // its pending state. When you wire up a real backend call,
      // replace the timeout with the API request.
      await new Promise((resolve) => setTimeout(resolve, 350));

      let resolvedDatasetId = payload.datasetId ?? "";
      let resolvedDatasetName = "";
      let resolvedPurpose: Dataset["purpose"] | undefined;
      setDatasets((prev) => {
        if (payload.datasetId) {
          const found = prev.find((d) => d.id === payload.datasetId);
          resolvedDatasetName = found?.name ?? payload.datasetId;
          resolvedPurpose = found?.purpose;
          return prev.map((d) =>
            d.id === payload.datasetId
              ? {
                  ...d,
                  traceCount: d.traceCount + 1,
                  eventCount: (d.eventCount ?? 0) + payload.count,
                  updatedAt: new Date().toISOString(),
                }
              : d,
          );
        }
        if (payload.newDataset) {
          resolvedDatasetId = `ds_new_${Date.now().toString(36)}`;
          resolvedDatasetName = payload.newDataset.name;
          resolvedPurpose = payload.newDataset.purpose;
          return [
            {
              id: resolvedDatasetId,
              name: payload.newDataset.name,
              description: payload.newDataset.description,
              purpose: payload.newDataset.purpose,
              traceCount: 1,
              eventCount: payload.count,
              updatedAt: new Date().toISOString(),
              createdBy: "you",
              tags: [],
            },
            ...prev,
          ];
        }
        return prev;
      });

      setMemberships((prev) => {
        const next = new Map(prev);
        const existing = next.get(payload.traceId) ?? [];
        const filtered = existing.filter(
          (m) =>
            !(
              m.datasetId === resolvedDatasetId &&
              (m.split ?? null) === (payload.split ?? null)
            ),
        );
        next.set(payload.traceId, [
          ...filtered,
          {
            datasetId: resolvedDatasetId,
            datasetName: resolvedDatasetName,
            purpose: resolvedPurpose,
            split: payload.split,
            addedAt: new Date().toISOString(),
            note: payload.notes,
          },
        ]);
        return next;
      });
    },
    [],
  );

  const getMemberships = React.useCallback(
    (traceId: string) => memberships.get(traceId) ?? [],
    [memberships],
  );

  return (
    <div className={cx("flex min-h-0 flex-1 flex-col", className)}>
      <StreamTimelineViewer
        events={events}
        playback={playback}
        selectedEventId={selectedEventId}
        onPlaybackChange={setPlayback}
        onSelect={(e) => setSelectedEventId(e.eventId)}
        initialCenterMs={initialCenterMs}
        initialHalfWidthMs={20 * 60 * 1000}
        toolbarLeading={
          toolbarLeading ?? <span>Chronicle / Live events</span>
        }
        showDetailPanel
        showFilters
        showConnectors
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        datasets={datasets}
        onAddTraceToDataset={handleAddTraceToDataset}
        getDatasetMembershipsForTrace={getMemberships}
        className="flex-1"
      />
    </div>
  );
}
