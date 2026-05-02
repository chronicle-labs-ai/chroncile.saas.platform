import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

import { StreamTimelineViewer } from "./stream-timeline-viewer";
import {
  STREAM_TIMELINE_MOCK_ANCHOR_MS,
  datasetsSeed,
  streamTimelineDenseSeed,
  streamTimelineEmptySeed,
  streamTimelineSeed,
} from "./data";
import type { StreamTimelineGroupBy } from "./stream-timeline-toolbar";
import type {
  AddTraceToDatasetPayload,
  Dataset,
  StreamPlaybackState,
  StreamTimelineEvent,
  TraceDatasetMembership,
  TraceKeyFn,
} from "./types";

const meta: Meta<typeof StreamTimelineViewer> = {
  title: "StreamTimeline/Viewer",
  component: StreamTimelineViewer,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof StreamTimelineViewer>;

/* ──────────────────────────────────────────────────────────────
 * Default — production-like view.
 *
 * One story exercises the whole feature surface so reviewers can
 * see how the pieces compose:
 *
 *   • Filter rail (Source / Type / Actor / Trace)
 *   • Trace highlight + connector arcs on selection
 *   • Topic ↔ Trace group-by toggle
 *   • Unified event-detail sidebar with prev/next stepping through
 *     the trace and an inline trace list
 *   • Dataset builder bottom-right CTA + inline list of datasets +
 *     recent additions log
 *   • Live playhead + Fit toolbar controls
 *
 * Apps that only want a subset just leave the corresponding props
 * unset; the viewer hides the matching surfaces automatically.
 * ────────────────────────────────────────────────────────────── */

interface AdditionLogEntry {
  at: string;
  payload: AddTraceToDatasetPayload;
  resolvedDatasetName: string;
}

function ProductionStory({
  events,
  initialPlayback = "paused",
  initialCenterMs,
  initialHalfWidthMs,
  initialGroupBy = "topic",
  enableGroupByToggle = true,
  enableFilters = true,
  enableConnectors = true,
  enableDatasets = true,
  enableSidePanel = true,
  traceKey,
  toolbarLeading,
}: {
  events: readonly StreamTimelineEvent[];
  initialPlayback?: StreamPlaybackState;
  initialCenterMs?: number;
  initialHalfWidthMs?: number;
  initialGroupBy?: StreamTimelineGroupBy;
  enableGroupByToggle?: boolean;
  enableFilters?: boolean;
  enableConnectors?: boolean;
  enableDatasets?: boolean;
  enableSidePanel?: boolean;
  traceKey?: TraceKeyFn;
  toolbarLeading?: React.ReactNode;
}) {
  const [playback, setPlayback] = React.useState<StreamPlaybackState>(
    initialPlayback,
  );
  const [selectedEventId, setSelectedEventId] = React.useState<string | null>(
    null,
  );
  const [groupBy, setGroupBy] =
    React.useState<StreamTimelineGroupBy>(initialGroupBy);
  const [datasets, setDatasets] = React.useState<Dataset[]>(() => [
    ...datasetsSeed,
  ]);
  const [log, setLog] = React.useState<AdditionLogEntry[]>([]);
  /* traceId → memberships. The picker tags datasets the trace is
     already in with an `Added` check; the sidebar grows an `In
     datasets` section listing them. */
  const [memberships, setMemberships] = React.useState<
    Map<string, TraceDatasetMembership[]>
  >(() => new Map());

  const handleAddTraceToDataset = React.useCallback(
    async (payload: AddTraceToDatasetPayload) => {
      // Simulate a backend round-trip so the picker shows pending state.
      await new Promise((resolve) => setTimeout(resolve, 350));

      let resolvedDatasetName = "";
      let resolvedDatasetId = payload.datasetId ?? "";
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
          resolvedDatasetName = payload.newDataset.name;
          resolvedDatasetId = `ds_new_${Date.now().toString(36)}`;
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
        // Don't add a duplicate (same dataset, same split) — bump the
        // timestamp instead.
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

      setLog((prev) =>
        [
          {
            at: new Date().toISOString(),
            payload,
            resolvedDatasetName,
          },
          ...prev,
        ].slice(0, 8),
      );
      console.log("addTraceToDataset", payload);
    },
    [],
  );

  const getMemberships = React.useCallback(
    (traceId: string) => memberships.get(traceId) ?? [],
    [memberships],
  );

  const viewer = (
    <StreamTimelineViewer
      events={events}
      playback={playback}
      selectedEventId={selectedEventId}
      onPlaybackChange={setPlayback}
      onSelect={(e) => setSelectedEventId(e.eventId)}
      initialCenterMs={initialCenterMs}
      initialHalfWidthMs={initialHalfWidthMs}
      toolbarLeading={
        toolbarLeading ?? <span>Chronicle / Live events</span>
      }
      showDetailPanel={enableSidePanel}
      showConnectors={enableConnectors}
      showFilters={enableFilters}
      groupBy={groupBy}
      onGroupByChange={enableGroupByToggle ? setGroupBy : undefined}
      traceKey={traceKey}
      datasets={enableDatasets ? datasets : undefined}
      onAddTraceToDataset={
        enableDatasets ? handleAddTraceToDataset : undefined
      }
      getDatasetMembershipsForTrace={
        enableDatasets ? getMemberships : undefined
      }
      className="flex-1"
    />
  );

  if (!enableDatasets) {
    return (
      <div className="flex h-screen flex-col bg-page p-s-4">{viewer}</div>
    );
  }

  return (
    <div className="flex h-screen flex-col gap-s-3 bg-page p-s-4">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-s-3 lg:grid-cols-[1fr_300px]">
        {viewer}
        <DatasetSidebar datasets={datasets} log={log} />
      </div>
    </div>
  );
}

function DatasetSidebar({
  datasets,
  log,
}: {
  datasets: readonly Dataset[];
  log: readonly AdditionLogEntry[];
}) {
  return (
    <aside className="flex min-h-0 flex-col gap-s-3 overflow-hidden">
      <section className="flex flex-col overflow-hidden rounded-l border border-hairline bg-l-surface">
        <header className="border-b border-hairline bg-l-surface-bar px-s-3 py-s-2">
          <span className="font-mono text-mono-sm uppercase tracking-tactical text-ink-dim">
            Datasets ({datasets.length})
          </span>
        </header>
        <ul className="max-h-[260px] overflow-y-auto py-s-1">
          {datasets.map((d) => (
            <li
              key={d.id}
              className="flex items-start gap-s-2 px-s-3 py-s-2 hover:bg-l-surface-hover"
            >
              <div className="flex min-w-0 flex-col gap-[2px]">
                <span className="truncate font-mono text-mono text-ink-hi">
                  {d.name}
                </span>
                <span className="font-mono text-mono-xs text-ink-dim tabular-nums">
                  {d.traceCount.toLocaleString()} traces
                  {d.eventCount !== undefined ? (
                    <>
                      <span className="mx-s-1">·</span>
                      {d.eventCount.toLocaleString()} events
                    </>
                  ) : null}
                  {d.purpose ? (
                    <>
                      <span className="mx-s-1">·</span>
                      <span className="uppercase tracking-tactical">
                        {d.purpose}
                      </span>
                    </>
                  ) : null}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-l border border-hairline bg-l-surface">
        <header className="border-b border-hairline bg-l-surface-bar px-s-3 py-s-2">
          <span className="font-mono text-mono-sm uppercase tracking-tactical text-ink-dim">
            Recent additions ({log.length})
          </span>
        </header>
        <ol className="flex-1 overflow-y-auto py-s-1">
          {log.length === 0 ? (
            <li className="px-s-3 py-s-3 font-mono text-mono-sm text-ink-dim">
              Pick any event → click &ldquo;Add trace&rdquo; in the
              bottom-right of the sidebar. Single-event additions are
              tagged{" "}
              <span className="rounded-l-sm bg-l-surface-hover px-s-1 uppercase tracking-tactical text-ink-faint">
                solo
              </span>{" "}
              so callers can route them differently.
            </li>
          ) : (
            log.map((entry, idx) => (
              <li
                key={`${entry.at}-${idx}`}
                className="flex flex-col gap-[2px] border-t border-hairline px-s-3 py-s-2 first:border-t-0"
              >
                <div className="flex items-baseline gap-s-2">
                  <span className="truncate font-mono text-mono text-ink-hi">
                    → {entry.resolvedDatasetName}
                  </span>
                  <span className="ml-auto shrink-0 font-mono text-mono-xs text-ink-dim tabular-nums">
                    {new Date(entry.at).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                      hour12: false,
                    })}
                  </span>
                </div>
                <span className="font-mono text-mono-xs text-ink-dim">
                  {entry.payload.traceLabel ?? entry.payload.traceId} ·{" "}
                  {entry.payload.count}{" "}
                  {entry.payload.count === 1 ? "event" : "events"}
                  {entry.payload.traceSynthesized ? " · solo" : null}
                  {entry.payload.split ? ` · ${entry.payload.split}` : null}
                  {entry.payload.newDataset ? " · new dataset" : null}
                </span>
              </li>
            ))
          )}
        </ol>
      </section>
    </aside>
  );
}

/* ── Stories ──────────────────────────────────────────────── */

/**
 * Default — comprehensive production view. Pick an event to see
 * the unified sidebar; use ‹ › in its header to step through the
 * trace; click any list item to jump; click "Add trace" to add the
 * trace (or trace-of-one) to a dataset.
 */
export const Default: Story = {
  render: () => (
    <ProductionStory
      events={streamTimelineSeed}
      initialCenterMs={STREAM_TIMELINE_MOCK_ANCHOR_MS - 15 * 60 * 1000}
      initialHalfWidthMs={20 * 60 * 1000}
    />
  ),
};

/**
 * TraceMode — the same content rendered with `groupBy="trace"` so
 * each row is one trace; the toolbar's Topic / Trace toggle flips
 * between modes without losing selection or filters.
 */
export const TraceMode: Story = {
  render: () => (
    <ProductionStory
      events={streamTimelineSeed}
      initialCenterMs={STREAM_TIMELINE_MOCK_ANCHOR_MS - 15 * 60 * 1000}
      initialHalfWidthMs={20 * 60 * 1000}
      initialGroupBy="trace"
    />
  ),
};

function DerivedTraceStory() {
  const events = React.useMemo<StreamTimelineEvent[]>(() => {
    const base = STREAM_TIMELINE_MOCK_ANCHOR_MS - 10 * 60 * 1000;
    const conversation = "conv_demo_001";
    return [
      {
        id: "evt_d_01",
        source: "intercom",
        type: "conversation.created",
        occurredAt: new Date(base).toISOString(),
        payload: { conversation_id: conversation, text: "Hi, I need help" },
      },
      {
        id: "evt_d_02",
        source: "slack",
        type: "message.posted",
        occurredAt: new Date(base + 30_000).toISOString(),
        payload: { conversation_id: conversation, text: "@here new ticket" },
      },
      {
        id: "evt_d_03",
        source: "intercom",
        type: "conversation.message.created",
        occurredAt: new Date(base + 90_000).toISOString(),
        payload: {
          conversation_id: conversation,
          text: "Looking at it now",
        },
      },
      {
        id: "evt_d_04",
        source: "intercom",
        type: "conversation.closed",
        occurredAt: new Date(base + 240_000).toISOString(),
        payload: { conversation_id: conversation, text: "Resolved" },
      },
    ];
  }, []);

  return (
    <ProductionStory
      events={events}
      initialCenterMs={STREAM_TIMELINE_MOCK_ANCHOR_MS - 8 * 60 * 1000}
      initialHalfWidthMs={6 * 60 * 1000}
      toolbarLeading={<span>Chronicle / Derived trace demo</span>}
      traceKey={(e) =>
        typeof e.payload?.conversation_id === "string"
          ? (e.payload.conversation_id as string)
          : undefined
      }
    />
  );
}

/**
 * DerivedTrace — shows the `traceKey` callback. The events here
 * have no explicit `traceId`; the viewer derives one from
 * `payload.conversation_id` so trace highlight, connectors, the
 * unified sidebar and the dataset CTA all light up without any
 * backend changes.
 */
export const DerivedTrace: Story = {
  render: () => <DerivedTraceStory />,
};

/**
 * Dense — 400 events over a 60-minute window so the row-level
 * bucketing logic is visible at default zoom. Wheel-zoom in to
 * resolve individual marks.
 */
export const Dense: Story = {
  render: () => (
    <ProductionStory
      events={streamTimelineDenseSeed}
      initialCenterMs={STREAM_TIMELINE_MOCK_ANCHOR_MS - 30 * 60 * 1000}
      initialHalfWidthMs={45 * 60 * 1000}
    />
  ),
};

/** Empty — empty-state copy + the no-events axis state. */
export const Empty: Story = {
  render: () => <ProductionStory events={streamTimelineEmptySeed} />,
};

/* ── Live ─────────────────────────────────────────────────── */

const LIVE_SOURCES = [
  {
    source: "intercom",
    types: ["conversation.created", "conversation.message.created"],
  },
  { source: "stripe", types: ["charge.succeeded", "invoice.paid"] },
  { source: "slack", types: ["message.posted", "reaction.added"] },
  { source: "github", types: ["push", "pull_request.opened"] },
];

function seedRecent(count: number, idOffset = 0): StreamTimelineEvent[] {
  const now = Date.now();
  const out: StreamTimelineEvent[] = [];
  for (let i = 0; i < count; i++) {
    const tmpl = LIVE_SOURCES[(idOffset + i) % LIVE_SOURCES.length]!;
    out.push({
      id: `evt_live_${idOffset + i}`,
      source: tmpl.source,
      type: tmpl.types[(idOffset + i) % tmpl.types.length]!,
      occurredAt: new Date(now - (count - i) * 250).toISOString(),
      actor: "live",
      payload: { live: true, idx: idOffset + i },
    });
  }
  return out;
}

function LiveStory() {
  const [events, setEvents] = React.useState<StreamTimelineEvent[]>(() =>
    seedRecent(40),
  );
  const [playback, setPlayback] =
    React.useState<StreamPlaybackState>("live");
  const [selectedEventId, setSelectedEventId] = React.useState<string | null>(
    null,
  );

  React.useEffect(() => {
    if (playback !== "live" && playback !== "playing") return;
    const id = window.setInterval(() => {
      setEvents((prev) => [...prev, ...seedRecent(1, prev.length)]);
    }, 600);
    return () => window.clearInterval(id);
  }, [playback]);

  return (
    <div className="flex h-screen flex-col bg-page p-s-4">
      <StreamTimelineViewer
        events={events}
        playback={playback}
        selectedEventId={selectedEventId}
        onPlaybackChange={setPlayback}
        onSelect={(e) => setSelectedEventId(e.eventId)}
        toolbarLeading={<span>Chronicle / Live events</span>}
        showDetailPanel
        className="flex-1"
      />
    </div>
  );
}

/**
 * Live — re-anchors to `Date.now()` and synthesizes a new event
 * every ~600ms so you can watch the playhead auto-follow at 75%
 * of the viewport. Datasets and the filter rail are intentionally
 * disabled here so the live behaviour is the only thing on screen.
 */
export const Live: Story = {
  render: () => <LiveStory />,
};
