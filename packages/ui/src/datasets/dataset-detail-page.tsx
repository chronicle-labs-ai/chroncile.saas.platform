"use client";

import * as React from "react";
import { Check, Pencil, X } from "lucide-react";

import { cx } from "../utils/cx";
import { Button } from "../primitives/button";
import { Input } from "../primitives/input";
import { Tab, TabList, TabPanel, Tabs } from "../primitives/tabs";
import {
  StreamTimelineViewer,
  type StreamPlaybackState,
  type StreamTimelineGroupBy,
} from "../stream-timeline";

import { DATASET_PURPOSE_META } from "./purpose-meta";
import { DatasetActionsMenu } from "./dataset-actions-menu";
import { DatasetClusterCard } from "./dataset-cluster-card";
import { DatasetEmpty } from "./dataset-empty";
import { DatasetGraphView } from "./dataset-graph-view";
import { DatasetMetricsStrip } from "./dataset-metrics-strip";
import {
  TraceSummaryRow,
  buildClusterIndex,
} from "./trace-summary-row";
import type {
  AddTraceToDatasetHandler,
  DatasetMembershipsResolver,
} from "../stream-timeline/types";
import type {
  Dataset,
  DatasetCluster,
  DatasetSnapshot,
  TraceSummary,
  UpdateDatasetHandler,
} from "./types";

/*
 * DatasetDetailPage — full dataset detail surface. Tabs:
 *
 *   Overview · Traces · Clusters · Graph · Timeline
 *
 * Phase 5 implements Overview / Traces / Clusters in full and renders
 * placeholders for Graph and Timeline. The placeholders are passed
 * through `renderGraph` and `renderTimeline` slots so later phases
 * (`graph-view`, `timeline-tab`) can plug in without touching this
 * file.
 *
 * The page is presentational w.r.t. dataset mutations — every CRUD
 * action goes through the supplied handlers. State that's local to
 * the page (active tab, trace search query, group-by toggle, inline
 * rename) lives here.
 */

export type DatasetDetailTab =
  | "overview"
  | "traces"
  | "clusters"
  | "graph"
  | "timeline";

export const DATASET_DETAIL_TABS: readonly DatasetDetailTab[] = [
  "overview",
  "traces",
  "clusters",
  "graph",
  "timeline",
];

export interface DatasetDetailPageProps {
  snapshot: DatasetSnapshot;
  /** Active tab (controlled). Falls back to internal state when absent. */
  tab?: DatasetDetailTab;
  defaultTab?: DatasetDetailTab;
  onTabChange?: (tab: DatasetDetailTab) => void;

  /** Selected trace — drives row highlight + drawer integration in
   *  the trace-drawer phase. */
  selectedTraceId?: string | null;
  onSelectTrace?: (traceId: string | null) => void;

  /** CRUD passthrough. */
  onUpdateDataset?: UpdateDatasetHandler;
  onEditDataset?: (id: string) => void;
  onDeleteDataset?: (id: string) => void;
  onDuplicateDataset?: (id: string) => void;

  /** Datasets the user can add traces to from the embedded timeline.
   *  Defaults to a single-element list containing this dataset so the
   *  Add-to-Dataset CTA continues to work inside the detail page. */
  datasetsForAdd?: readonly Dataset[];
  /** Add-to-Dataset handler — forwarded to the embedded timeline. */
  onAddTraceToDataset?: AddTraceToDatasetHandler;
  /** Resolver that returns memberships for a given trace id. */
  getDatasetMembershipsForTrace?: DatasetMembershipsResolver;

  /** Render slot overrides. When omitted, the page renders the
   *  default Graph / Timeline panels. */
  renderGraph?: (snapshot: DatasetSnapshot) => React.ReactNode;
  renderTimeline?: (snapshot: DatasetSnapshot) => React.ReactNode;

  /** Tone the page header — used by Storybook stories that want a
   *  full-bleed dark canvas. */
  className?: string;
}

export function DatasetDetailPage({
  snapshot,
  tab: tabProp,
  defaultTab = "overview",
  onTabChange,
  selectedTraceId,
  onSelectTrace,
  onUpdateDataset,
  onEditDataset,
  onDeleteDataset,
  onDuplicateDataset,
  datasetsForAdd,
  onAddTraceToDataset,
  getDatasetMembershipsForTrace,
  renderGraph,
  renderTimeline,
  className,
}: DatasetDetailPageProps) {
  const [tabState, setTabState] = React.useState<DatasetDetailTab>(defaultTab);
  const tab = tabProp ?? tabState;
  const setTab = (next: DatasetDetailTab) => {
    setTabState(next);
    onTabChange?.(next);
  };

  return (
    <div
      className={cx(
        "flex h-full min-h-0 flex-1 flex-col overflow-hidden",
        className,
      )}
    >
      <DetailHeader
        dataset={snapshot.dataset}
        onUpdate={onUpdateDataset}
        onEdit={onEditDataset}
        onDelete={onDeleteDataset}
        onDuplicate={onDuplicateDataset}
      />

      <Tabs
        density="compact"
        value={tab}
        onValueChange={(next) => setTab(next as DatasetDetailTab)}
        className="flex flex-1 min-h-0 flex-col"
      >
        <TabList
          aria-label="Dataset detail"
          className="px-4"
        >
          <Tab id="overview">Overview</Tab>
          <Tab id="traces">
            Traces
            <span className="ml-1.5 font-mono text-[10px] text-l-ink-dim">
              {snapshot.traces.length}
            </span>
          </Tab>
          <Tab id="clusters">
            Clusters
            <span className="ml-1.5 font-mono text-[10px] text-l-ink-dim">
              {snapshot.clusters.length}
            </span>
          </Tab>
          <Tab id="graph">Graph</Tab>
          <Tab id="timeline">Timeline</Tab>
        </TabList>

        <div className="flex-1 min-h-0 overflow-auto">
          <TabPanel id="overview" className="p-4">
            <OverviewTab snapshot={snapshot} onSelectTrace={onSelectTrace} />
          </TabPanel>
          <TabPanel id="traces" className="p-4">
            <TracesTab
              snapshot={snapshot}
              selectedTraceId={selectedTraceId ?? null}
              onSelectTrace={onSelectTrace}
            />
          </TabPanel>
          <TabPanel id="clusters" className="p-4">
            <ClustersTab
              snapshot={snapshot}
              selectedTraceId={selectedTraceId ?? null}
              onSelectTrace={onSelectTrace}
            />
          </TabPanel>
          <TabPanel id="graph" className="flex-1 min-h-0 p-0">
            {renderGraph ? (
              renderGraph(snapshot)
            ) : (
              <DatasetGraphView
                snapshot={snapshot}
                selectedTraceId={selectedTraceId ?? null}
                onSelectTrace={onSelectTrace}
              />
            )}
          </TabPanel>
          <TabPanel id="timeline" className="flex-1 min-h-0 p-0">
            {renderTimeline ? (
              renderTimeline(snapshot)
            ) : (
              <TimelineTab
                snapshot={snapshot}
                selectedTraceId={selectedTraceId ?? null}
                onSelectTrace={onSelectTrace}
                datasetsForAdd={datasetsForAdd}
                onAddTraceToDataset={onAddTraceToDataset}
                getDatasetMembershipsForTrace={getDatasetMembershipsForTrace}
              />
            )}
          </TabPanel>
        </div>
      </Tabs>
    </div>
  );
}

/* ── Header ──────────────────────────────────────────────── */

interface DetailHeaderProps {
  dataset: Dataset;
  onUpdate?: UpdateDatasetHandler;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
}

function DetailHeader({
  dataset,
  onUpdate,
  onEdit,
  onDelete,
  onDuplicate,
}: DetailHeaderProps) {
  const meta = dataset.purpose ? DATASET_PURPOSE_META[dataset.purpose] : null;
  const PurposeIcon = meta?.Icon;

  const [editing, setEditing] = React.useState(false);
  const [draftName, setDraftName] = React.useState(dataset.name);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setDraftName(dataset.name);
  }, [dataset.name]);

  React.useEffect(() => {
    if (editing) {
      const id = window.setTimeout(() => inputRef.current?.select(), 30);
      return () => window.clearTimeout(id);
    }
  }, [editing]);

  const commit = async () => {
    const trimmed = draftName.trim();
    if (trimmed.length === 0 || trimmed === dataset.name) {
      setDraftName(dataset.name);
      setEditing(false);
      return;
    }
    if (onUpdate) {
      try {
        await onUpdate({ id: dataset.id, patch: { name: trimmed } });
      } catch {
        setDraftName(dataset.name);
      }
    }
    setEditing(false);
  };

  const cancel = () => {
    setDraftName(dataset.name);
    setEditing(false);
  };

  return (
    <header className="flex flex-shrink-0 items-start gap-3 border-b border-l-border-faint px-4 py-3">
      <span
        className={cx(
          "flex size-9 shrink-0 items-center justify-center rounded-[3px]",
          meta?.tile ?? "bg-l-surface-input",
        )}
        aria-hidden
      >
        {PurposeIcon ? (
          <PurposeIcon
            className={cx("size-4.5", meta?.ink)}
            strokeWidth={1.6}
          />
        ) : null}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {editing ? (
          <div className="flex items-center gap-1.5">
            <Input
              ref={inputRef}
              density="compact"
              value={draftName}
              onChange={(e) => setDraftName(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void commit();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  cancel();
                }
              }}
              className="max-w-[420px]"
              aria-label="Dataset name"
            />
            <Button
              density="compact"
              variant="icon"
              size="sm"
              aria-label="Save name"
              onPress={() => void commit()}
            >
              <Check className="size-3.5" strokeWidth={1.75} />
            </Button>
            <Button
              density="compact"
              variant="icon"
              size="sm"
              aria-label="Cancel rename"
              onPress={cancel}
            >
              <X className="size-3.5" strokeWidth={1.75} />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onUpdate && setEditing(true)}
            className={cx(
              "group inline-flex items-center gap-1.5 self-start rounded-[2px] text-left",
              "font-sans text-[18px] font-medium leading-tight text-l-ink",
              onUpdate
                ? "hover:bg-l-surface-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember/40"
                : "cursor-text",
            )}
            disabled={!onUpdate}
          >
            <span className="px-1">{dataset.name}</span>
            {onUpdate ? (
              <Pencil
                className="size-3 text-l-ink-dim opacity-0 transition-opacity group-hover:opacity-100"
                strokeWidth={1.75}
              />
            ) : null}
          </button>
        )}
        <div className="flex items-center gap-2 font-mono text-[11px] text-l-ink-dim">
          <span
            aria-hidden
            className={cx("size-1.5 rounded-pill", meta?.dot ?? "bg-l-ink-dim")}
          />
          <span>{meta?.label ?? "Dataset"}</span>
          {dataset.createdBy ? (
            <>
              <span aria-hidden>·</span>
              <span>{dataset.createdBy}</span>
            </>
          ) : null}
          <span aria-hidden>·</span>
          <span>{dataset.id}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <DatasetActionsMenu
          dataset={dataset}
          onEdit={onEdit}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
        />
      </div>
    </header>
  );
}

/* ── Overview tab ─────────────────────────────────────────── */

interface TabProps {
  snapshot: DatasetSnapshot;
  selectedTraceId?: string | null;
  onSelectTrace?: (traceId: string | null) => void;
}

function OverviewTab({
  snapshot,
  onSelectTrace,
}: Omit<TabProps, "selectedTraceId">) {
  const recent = React.useMemo(() => {
    return [...snapshot.traces]
      .sort((a, b) => {
        const aT = a.addedAt ? new Date(a.addedAt).getTime() : 0;
        const bT = b.addedAt ? new Date(b.addedAt).getTime() : 0;
        return bT - aT;
      })
      .slice(0, 5);
  }, [snapshot.traces]);

  const clusterIndex = React.useMemo(
    () => buildClusterIndex(snapshot.clusters),
    [snapshot.clusters],
  );

  if (snapshot.traces.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <DatasetMetricsStrip snapshot={snapshot} />
        <DatasetEmpty variant="detail" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <DatasetMetricsStrip snapshot={snapshot} />

      {snapshot.clusters.length > 0 ? (
        <section className="flex flex-col gap-2">
          <SectionHeading>Clusters</SectionHeading>
          <div className="flex flex-wrap gap-2">
            {snapshot.clusters.map((cluster) => (
              <ClusterLegendItem key={cluster.id} cluster={cluster} />
            ))}
          </div>
        </section>
      ) : null}

      {recent.length > 0 ? (
        <section className="flex flex-col gap-2">
          <SectionHeading>Recent additions</SectionHeading>
          <div className="rounded-[4px] border border-l-border bg-l-surface-raised">
            {recent.map((trace) => (
              <TraceSummaryRow
                key={trace.traceId}
                trace={trace}
                cluster={
                  trace.clusterId
                    ? clusterIndex.get(trace.clusterId) ?? null
                    : null
                }
                density="comfy"
                onSelect={
                  onSelectTrace ? (id) => onSelectTrace(id) : undefined
                }
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ClusterLegendItem({ cluster }: { cluster: DatasetCluster }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-[3px] border border-l-border bg-l-surface-raised px-2 py-1.5">
      <span
        aria-hidden
        className="size-2 rounded-pill"
        style={{ background: cluster.color }}
      />
      <span className="font-sans text-[12px] text-l-ink">
        {cluster.label}
      </span>
      <span className="font-mono text-[10px] text-l-ink-dim">
        {cluster.traceIds.length}
      </span>
    </span>
  );
}

/* ── Traces tab ───────────────────────────────────────────── */

function TracesTab({
  snapshot,
  selectedTraceId,
  onSelectTrace,
}: TabProps) {
  const [query, setQuery] = React.useState("");
  const [groupByCluster, setGroupByCluster] = React.useState(true);

  const clusterIndex = React.useMemo(
    () => buildClusterIndex(snapshot.clusters),
    [snapshot.clusters],
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return snapshot.traces;
    return snapshot.traces.filter((trace) => {
      const cluster = trace.clusterId
        ? clusterIndex.get(trace.clusterId)?.label ?? ""
        : "";
      const haystack = `${trace.label} ${trace.traceId} ${trace.primarySource} ${cluster}`;
      return haystack.toLowerCase().includes(q);
    });
  }, [query, snapshot.traces, clusterIndex]);

  const grouped = React.useMemo(() => {
    if (!groupByCluster) {
      return [
        { cluster: null as DatasetCluster | null, traces: filtered },
      ];
    }
    const buckets = new Map<string, TraceSummary[]>();
    const ordered: { cluster: DatasetCluster | null; traces: TraceSummary[] }[] = [];
    for (const trace of filtered) {
      const key = trace.clusterId ?? "__none__";
      if (!buckets.has(key)) {
        buckets.set(key, []);
        const cluster = trace.clusterId
          ? clusterIndex.get(trace.clusterId) ?? null
          : null;
        ordered.push({ cluster, traces: buckets.get(key)! });
      }
      buckets.get(key)!.push(trace);
    }
    return ordered;
  }, [groupByCluster, filtered, clusterIndex]);

  if (snapshot.traces.length === 0) {
    return <DatasetEmpty variant="detail" />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          density="compact"
          search
          placeholder={`Search ${snapshot.traces.length} traces`}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          className="max-w-[280px]"
        />
        <label className="ml-auto inline-flex items-center gap-1.5 font-sans text-[11.5px] text-l-ink-lo">
          <input
            type="checkbox"
            checked={groupByCluster}
            onChange={(e) => setGroupByCluster(e.currentTarget.checked)}
            className="accent-ember"
          />
          Group by cluster
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[4px] border border-l-border bg-l-surface-raised px-4 py-8 text-center font-mono text-[11px] text-l-ink-dim">
          No traces match.{" "}
          <button
            type="button"
            className="text-ember hover:underline"
            onClick={() => setQuery("")}
          >
            Clear
          </button>
        </div>
      ) : (
        <div className="rounded-[4px] border border-l-border bg-l-surface-raised">
          <TracesTableHeader showCluster={!groupByCluster} />
          <div>
            {grouped.map((group) => (
              <React.Fragment key={group.cluster?.id ?? "__none__"}>
                {groupByCluster && group.cluster ? (
                  <GroupHead cluster={group.cluster} count={group.traces.length} />
                ) : groupByCluster ? (
                  <GroupHead cluster={null} count={group.traces.length} />
                ) : null}
                {group.traces.map((trace) => (
                  <TraceSummaryRow
                    key={trace.traceId}
                    trace={trace}
                    cluster={
                      groupByCluster
                        ? null
                        : trace.clusterId
                          ? clusterIndex.get(trace.clusterId) ?? null
                          : null
                    }
                    isActive={trace.traceId === selectedTraceId}
                    onSelect={
                      onSelectTrace ? (id) => onSelectTrace(id) : undefined
                    }
                  />
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TracesTableHeader({ showCluster }: { showCluster: boolean }) {
  return (
    <div
      className={cx(
        "sticky top-0 z-[1] grid items-center gap-2 px-2 h-7",
        "grid-cols-[16px_18px_minmax(0,1.5fr)_minmax(0,0.7fr)_64px_64px_60px_16px]",
        "border-b border-l-border bg-l-surface-bar",
        "font-mono text-[10px] uppercase tracking-[0.06em] text-l-ink-dim",
      )}
    >
      <span aria-hidden />
      <span aria-hidden />
      <span>Trace</span>
      <span>{showCluster ? "Cluster" : ""}</span>
      <span className="text-right">Events</span>
      <span className="text-right">Dur</span>
      <span>Added</span>
      <span aria-hidden />
    </div>
  );
}

function GroupHead({
  cluster,
  count,
}: {
  cluster: DatasetCluster | null;
  count: number;
}) {
  return (
    <div className="sticky top-7 z-[1] flex items-center gap-2 border-b border-t border-l-border-faint bg-l-surface-bar-2 px-3 h-7 font-sans text-[11px] text-l-ink-lo">
      <span
        aria-hidden
        className="size-1.5 rounded-pill"
        style={{ background: cluster?.color ?? "var(--l-ink-dim)" }}
      />
      <span className="font-medium text-l-ink">
        {cluster?.label ?? "Unclustered"}
      </span>
      <span className="ml-auto font-mono text-[10px] text-l-ink-dim">
        {count} {count === 1 ? "trace" : "traces"}
      </span>
    </div>
  );
}

/* ── Clusters tab ─────────────────────────────────────────── */

function ClustersTab({
  snapshot,
  selectedTraceId,
  onSelectTrace,
}: TabProps) {
  if (snapshot.clusters.length === 0) {
    return (
      <DatasetEmpty
        variant="detail"
        // No bespoke title for a no-clusters case yet — reuse the
        // "no traces" copy which reads correctly on an empty dataset
        // and degrades gracefully when traces exist but cluster
        // assignments don't.
      />
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {snapshot.clusters.map((cluster, i) => (
        <DatasetClusterCard
          key={cluster.id}
          cluster={cluster}
          traces={snapshot.traces}
          defaultOpen={i === 0}
          selectedTraceId={selectedTraceId ?? null}
          onSelectTrace={
            onSelectTrace ? (id) => onSelectTrace(id) : undefined
          }
          initialVisible={6}
        />
      ))}
    </div>
  );
}

/* ── Section heading + deferred panels ────────────────────── */

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-sans text-[11px] font-medium uppercase tracking-[0.08em] text-l-ink-dim">
      {children}
    </h3>
  );
}

/* ── Timeline tab ─────────────────────────────────────────────
 *
 * Mirrors `product/TimelineDashboard`'s wiring of the
 * `StreamTimelineViewer` so the Dataset detail Timeline tab reads
 * exactly like the dedicated /dashboard/timeline page: same toolbar,
 * filter rail, connectors, detail sidebar, dataset CTA, and group-by
 * toggle. Selection and group-by state live here so the tab keeps
 * its own context (switching tabs back to Graph/Traces preserves the
 * timeline state).
 *
 * The trace ↔ event bridge: when the parent (e.g. the manager)
 * passes `selectedTraceId`, we look up the first event on that
 * trace and pass it as `selectedEventId` so the timeline highlights
 * the same trace the graph/traces tabs are showing. Selecting an
 * event in the timeline propagates the trace id back up via
 * `onSelectTrace`. */

interface TimelineTabProps {
  snapshot: DatasetSnapshot;
  selectedTraceId?: string | null;
  onSelectTrace?: (traceId: string | null) => void;
  datasetsForAdd?: readonly Dataset[];
  onAddTraceToDataset?: AddTraceToDatasetHandler;
  getDatasetMembershipsForTrace?: DatasetMembershipsResolver;
}

function TimelineTab({
  snapshot,
  selectedTraceId,
  onSelectTrace,
  datasetsForAdd,
  onAddTraceToDataset,
  getDatasetMembershipsForTrace,
}: TimelineTabProps) {
  const events = snapshot.events ?? [];
  const datasets = datasetsForAdd ?? [snapshot.dataset];

  // Local viewer state (parity with `TimelineDashboard`).
  const [playback, setPlayback] = React.useState<StreamPlaybackState>("paused");
  const [groupBy, setGroupBy] =
    React.useState<StreamTimelineGroupBy>("trace");
  const [selectedEventId, setSelectedEventId] = React.useState<string | null>(
    null,
  );

  // Sync the trace selection from the parent (graph / traces / clusters
  // tabs) into a concrete event highlight on the timeline. We pin the
  // first event of the selected trace so the playhead docks on the
  // start of the trace.
  React.useEffect(() => {
    if (!selectedTraceId) {
      setSelectedEventId(null);
      return;
    }
    const firstEvent = events.find((e) => e.traceId === selectedTraceId);
    setSelectedEventId(firstEvent?.id ?? null);
  }, [selectedTraceId, events]);

  // Center the timeline on the bulk of dataset activity. We pick the
  // median event timestamp so trailing outliers don't pull the view
  // off the dense band.
  const { initialCenterMs, initialHalfWidthMs } = React.useMemo(() => {
    if (events.length === 0) {
      return {
        initialCenterMs: Date.now(),
        initialHalfWidthMs: 30 * 60 * 1000,
      };
    }
    const ts = events
      .map((e) => new Date(e.occurredAt).getTime())
      .sort((a, b) => a - b);
    const median = ts[Math.floor(ts.length / 2)] ?? ts[0]!;
    const span = ts[ts.length - 1]! - ts[0]!;
    // Half-width covers the dense band but caps at 6h so high-spread
    // datasets don't open at "show me 10 days at once".
    const halfWidth = Math.min(
      Math.max(span / 4, 5 * 60 * 1000),
      6 * 60 * 60 * 1000,
    );
    return { initialCenterMs: median, initialHalfWidthMs: halfWidth };
  }, [events]);

  if (events.length === 0) {
    return (
      <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-2 p-6 text-center">
        <span className="font-sans text-[12.5px] text-l-ink-lo">
          No events to display
        </span>
        <span className="font-mono text-[11px] text-l-ink-dim">
          Add traces to this dataset to populate the timeline.
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-l-surface">
      <StreamTimelineViewer
        events={events}
        playback={playback}
        selectedEventId={selectedEventId}
        onPlaybackChange={setPlayback}
        onSelect={(e) => {
          setSelectedEventId(e.eventId);
          // Bubble the trace id up so the graph/traces tabs sync.
          if (!onSelectTrace) return;
          if (!e.event) {
            onSelectTrace(null);
            return;
          }
          onSelectTrace(e.event.traceId ?? null);
        }}
        initialCenterMs={initialCenterMs}
        initialHalfWidthMs={initialHalfWidthMs}
        toolbarLeading={
          <span className="flex items-center gap-1.5 font-mono text-[10.5px] tracking-[0.04em] text-l-ink-dim">
            <span className="truncate text-l-ink-lo">{snapshot.dataset.name}</span>
            <span aria-hidden>·</span>
            <span>{snapshot.traces.length} traces</span>
          </span>
        }
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        showFilters
        showConnectors
        showDetailPanel
        datasets={datasets}
        onAddTraceToDataset={onAddTraceToDataset}
        getDatasetMembershipsForTrace={getDatasetMembershipsForTrace}
        className="flex-1"
      />
    </div>
  );
}
