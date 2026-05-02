"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";

import { cx } from "../utils/cx";
import { Button } from "../primitives/button";
import { Drawer } from "../primitives/drawer";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../primitives/dialog";
import { Textarea } from "../primitives/textarea";
import { CompanyLogo } from "../icons";
import {
  StreamTimelineViewer,
  type StreamPlaybackState,
  type StreamTimelineEvent,
} from "../stream-timeline";
import { formatNumber, formatStableDateTime } from "../connections/time";

import { DatasetSplitChip } from "./dataset-split-chip";
import { formatTraceDuration } from "./trace-summary-row";
import type {
  DatasetCluster,
  DatasetSnapshot,
  RemoveTraceFromDatasetHandler,
  TraceSummary,
} from "./types";

/*
 * DatasetTraceDetailDrawer — overlay drawer for inspecting one trace
 * inside a dataset and (optionally) removing it from the dataset.
 *
 * Wraps `Drawer` with `density="compact"` and renders a stripped-down
 * `StreamTimelineViewer` filtered to events on this trace. The
 * Remove-from-dataset action surfaces a destructive confirm sub-dialog
 * with an optional reason field.
 */

export interface DatasetTraceDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Snapshot the trace lives in. Drives event lookup + dataset chip. */
  snapshot: DatasetSnapshot;
  /** Trace to inspect. When null/undefined, the drawer renders nothing. */
  trace: TraceSummary | null;
  /** Remove handler. When omitted, the Remove button is hidden. */
  onRemoveTrace?: RemoveTraceFromDatasetHandler;
  /** Optional secondary CTA — e.g. "Open in timeline" — that lets the
   *  parent navigate from the drawer to the full timeline tab. */
  onJumpToTimeline?: (traceId: string) => void;
  className?: string;
}

export function DatasetTraceDetailDrawer({
  isOpen,
  onClose,
  snapshot,
  trace,
  onRemoveTrace,
  onJumpToTimeline,
  className,
}: DatasetTraceDetailDrawerProps) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen) {
      setConfirmOpen(false);
      setReason("");
      setPending(false);
    }
  }, [isOpen]);

  if (!trace) return null;

  const cluster = trace.clusterId
    ? snapshot.clusters.find((c) => c.id === trace.clusterId) ?? null
    : null;

  const traceEvents = (snapshot.events ?? []).filter(
    (e) => e.traceId === trace.traceId,
  );

  const handleRemove = async () => {
    if (!onRemoveTrace) return;
    setPending(true);
    try {
      await onRemoveTrace({
        datasetId: snapshot.dataset.id,
        traceId: trace.traceId,
        reason: reason.trim() || undefined,
      });
      setConfirmOpen(false);
      onClose();
    } finally {
      setPending(false);
    }
  };

  return (
    <Drawer
      density="compact"
      isOpen={isOpen}
      onClose={onClose}
      placement="right"
      size="lg"
      className={className}
      title={<DrawerTitle trace={trace} cluster={cluster} />}
      actions={
        <div className="flex w-full items-center justify-between gap-2">
          {onJumpToTimeline ? (
            <Button
              density="compact"
              variant="ghost"
              size="sm"
              onPress={() => onJumpToTimeline(trace.traceId)}
            >
              Open in timeline
            </Button>
          ) : (
            <span />
          )}
          {onRemoveTrace ? (
            <Button
              density="compact"
              variant="critical"
              size="sm"
              onPress={() => setConfirmOpen(true)}
              leadingIcon={<Trash2 className="size-3.5" strokeWidth={1.75} />}
            >
              Remove from dataset
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="flex flex-col gap-3 pb-2">
        <SummaryStrip trace={trace} cluster={cluster} datasetName={snapshot.dataset.name} />

        {trace.note ? (
          <p className="rounded-[3px] border border-l-border bg-l-surface-input px-3 py-2 font-sans text-[12px] leading-snug text-l-ink-lo">
            <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-l-ink-dim">
              note
            </span>
            <br />
            {trace.note}
          </p>
        ) : null}

        <section className="flex flex-col gap-1.5">
          <SectionHeading>Events on this trace</SectionHeading>
          {traceEvents.length === 0 ? (
            <div className="rounded-[3px] border border-l-border bg-l-surface-input px-3 py-3 font-mono text-[11px] text-l-ink-dim">
              No events were captured for this trace yet.
            </div>
          ) : (
            <TraceTimelinePane trace={trace} traceEvents={traceEvents} />
          )}
        </section>
      </div>

      {/* Remove confirm sub-dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="w-[380px] max-w-[92vw]">
          <DialogHeader>
            <DialogTitle>Remove trace from dataset</DialogTitle>
            <DialogDescription>
              The trace stays in the timeline; only its membership in{" "}
              <span className="text-l-ink">{snapshot.dataset.name}</span> is
              removed.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-3">
            <div className="rounded-[3px] border border-l-border bg-l-surface-input px-3 py-2 font-sans text-[12px] text-l-ink">
              <div className="font-medium">{trace.label}</div>
              <div className="mt-0.5 font-mono text-[11px] text-l-ink-dim">
                {trace.traceId} · {formatNumber(trace.eventCount)} events
              </div>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="font-sans text-[11px] font-medium text-l-ink-lo">
                Reason (optional)
              </span>
              <Textarea
                density="compact"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.currentTarget.value)}
                placeholder="Duplicate of trace_xyz"
              />
            </label>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button density="compact" variant="ghost" size="sm">
                Cancel
              </Button>
            </DialogClose>
            <Button
              density="compact"
              variant="critical"
              size="sm"
              isLoading={pending}
              onPress={handleRemove}
            >
              Remove trace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Drawer>
  );
}

/* ── Subcomponents ────────────────────────────────────────── */

interface TraceTimelinePaneProps {
  trace: TraceSummary;
  traceEvents: readonly StreamTimelineEvent[];
}

/**
 * TraceTimelinePane — single-trace inspector embed that mirrors the
 * full Timeline tab styling: same `StreamTimelineViewer`, same
 * Linear-density chrome, but with the toolbar's group-by toggle
 * suppressed (a single trace has no topic/trace ambiguity), the
 * filter rail off (also no value with one trace), and the playhead
 * docked to the trace's first event.
 *
 * The pane carries its own `selectedEventId` state so the user can
 * click between events on the trace without affecting the dataset's
 * outer selection.
 */
function TraceTimelinePane({ trace, traceEvents }: TraceTimelinePaneProps) {
  const [playback, setPlayback] = React.useState<StreamPlaybackState>("paused");
  const [selectedEventId, setSelectedEventId] = React.useState<string | null>(
    () => traceEvents[0]?.id ?? null,
  );

  const { initialCenterMs, initialHalfWidthMs } = React.useMemo(() => {
    if (traceEvents.length === 0) {
      return {
        initialCenterMs: Date.now(),
        initialHalfWidthMs: 60_000,
      };
    }
    const ts = traceEvents
      .map((e) => new Date(e.occurredAt).getTime())
      .sort((a, b) => a - b);
    const first = ts[0]!;
    const last = ts[ts.length - 1]!;
    const span = Math.max(last - first, 5_000);
    return {
      initialCenterMs: first + span / 2,
      // 30% padding on either side so the first/last marks aren't
      // glued to the canvas edge.
      initialHalfWidthMs: Math.max(span * 0.65, 30_000),
    };
  }, [traceEvents]);

  return (
    <div className="flex h-[420px] min-h-0 flex-col rounded-[3px] border border-l-border bg-l-surface-raised">
      <StreamTimelineViewer
        events={traceEvents}
        playback={playback}
        selectedEventId={selectedEventId}
        onPlaybackChange={setPlayback}
        onSelect={(e) => setSelectedEventId(e.eventId)}
        initialCenterMs={initialCenterMs}
        initialHalfWidthMs={initialHalfWidthMs}
        toolbarLeading={
          <span className="font-mono text-[10.5px] text-l-ink-dim">
            Trace · {trace.label}
          </span>
        }
        groupBy="trace"
        showFilters={false}
        showDetailPanel={false}
        showConnectors
        rowHeight={26}
        className="flex-1"
      />
    </div>
  );
}

function DrawerTitle({
  trace,
  cluster,
}: {
  trace: TraceSummary;
  cluster: DatasetCluster | null;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-[3px] border border-l-border-faint bg-l-surface-input"
        aria-hidden
      >
        <CompanyLogo
          name={trace.primarySource}
          size={14}
          radius={2}
          fallbackBackground="transparent"
          fallbackColor="var(--l-ink-dim)"
        />
      </span>
      <div className="flex min-w-0 flex-col gap-[1px]">
        <span className="truncate font-sans text-[14px] font-medium text-l-ink">
          {trace.label}
        </span>
        <span className="flex items-center gap-1.5 truncate font-mono text-[10.5px] text-l-ink-dim">
          {cluster ? (
            <>
              <span
                aria-hidden
                className="size-1.5 rounded-pill"
                style={{ background: cluster.color }}
              />
              <span className="truncate">{cluster.label}</span>
              <span aria-hidden>·</span>
            </>
          ) : null}
          <span className="truncate">{trace.traceId}</span>
        </span>
      </div>
    </div>
  );
}

function SummaryStrip({
  trace,
  cluster,
  datasetName,
}: {
  trace: TraceSummary;
  cluster: DatasetCluster | null;
  datasetName: string;
}) {
  return (
    <dl
      className={cx(
        "grid grid-cols-2 gap-2 sm:grid-cols-4",
        "rounded-[3px] border border-l-border bg-l-surface-raised p-2.5",
      )}
    >
      <Cell label="Dataset">
        <span className="truncate text-l-ink">{datasetName}</span>
      </Cell>
      <Cell label="Cluster">
        {cluster ? (
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-1.5 rounded-pill"
              style={{ background: cluster.color }}
            />
            <span className="truncate">{cluster.label}</span>
          </span>
        ) : (
          <span className="text-l-ink-dim">—</span>
        )}
      </Cell>
      <Cell label="Events">
        <span className="font-mono">{formatNumber(trace.eventCount)}</span>
      </Cell>
      <Cell label="Duration">
        <span className="font-mono">{formatTraceDuration(trace.durationMs)}</span>
      </Cell>
      <Cell label="Status">
        <StatusInline status={trace.status} />
      </Cell>
      <Cell label="Split">
        {trace.split ? (
          <DatasetSplitChip split={trace.split} compact />
        ) : (
          <span className="text-l-ink-dim">—</span>
        )}
      </Cell>
      <Cell label="Started">
        <span className="font-mono text-[10.5px]">
          {formatStableDateTime(trace.startedAt)}
        </span>
      </Cell>
      <Cell label="Added by">
        <span className="font-mono text-[11px]">
          {trace.addedBy ?? "—"}
        </span>
      </Cell>
    </dl>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-[2px] min-w-0">
      <dt className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-l-ink-dim">
        {label}
      </dt>
      <dd className="truncate font-sans text-[12px] text-l-ink">{children}</dd>
    </div>
  );
}

function StatusInline({ status }: { status: TraceSummary["status"] }) {
  const meta = {
    ok: { label: "OK", color: "bg-l-status-done", text: "text-l-status-done" },
    warn: {
      label: "Warn",
      color: "bg-l-status-inprogress",
      text: "text-l-status-inprogress",
    },
    error: {
      label: "Error",
      color: "bg-l-p-urgent",
      text: "text-l-p-urgent",
    },
  }[status];
  return (
    <span className={cx("inline-flex items-center gap-1.5 font-medium", meta.text)}>
      <span aria-hidden className={cx("size-1.5 rounded-pill", meta.color)} />
      {meta.label}
    </span>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-sans text-[11px] font-medium uppercase tracking-[0.08em] text-l-ink-dim">
      {children}
    </h3>
  );
}
