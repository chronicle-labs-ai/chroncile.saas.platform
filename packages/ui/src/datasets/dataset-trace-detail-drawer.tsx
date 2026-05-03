"use client";

import * as React from "react";
import {
  Activity,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Database,
  Fingerprint,
  GitBranch,
  Hash,
  Layers as LayersIcon,
  Tag,
  Trash2,
  User,
  X,
  type LucideIcon,
} from "lucide-react";

import { cx } from "../utils/cx";
import { Button } from "../primitives/button";
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
import { CopyButton } from "../primitives/copy-button";
import {
  sourceColor,
  sourceTintedBackground,
} from "../stream-timeline/source-color";
import type { StreamTimelineEvent } from "../stream-timeline";
import { formatNumber, formatStableDateTime } from "../connections/time";

import { DatasetSplitChip } from "./dataset-split-chip";
import { SourceLogoStack } from "./source-logo-stack";
import { formatTraceDuration } from "./dataset-traces-table-row";
import type {
  DatasetCluster,
  DatasetSnapshot,
  RemoveTraceFromDatasetHandler,
  TraceStatus,
  TraceSummary,
} from "./types";

/*
 * DatasetTraceDetailDrawer — inline trace inspector mounted beside
 * the dataset canvas. Visual model mirrors the timeline tab's
 * `StreamEventDetail` so the canvas's right rail reads as one
 * unified inspector regardless of which lens fired the selection:
 *
 *   1. Header — compact 40 px chrome: source breadcrumb + position
 *      stepper through the trace's events + copy id + close.
 *   2. Trace strip — when the trace has 2+ events, a navigable list
 *      sits above the details (matches `StreamEventDetail`'s
 *      `<TraceStrip>`).
 *   3. Details — Linear-style label/value rows for trace metadata
 *      (cluster, split, status, source, events, duration, started,
 *      added by, dataset).
 *   4. Footer — "Open in timeline" + "Remove from dataset" actions
 *      when the matching handlers are wired.
 *
 * The chrome is the same `<DetailHeader>` + `<Section>` +
 * `<DetailRow>` + `<TraceStrip>` shape as `StreamEventDetail`; only
 * the populated fields differ.
 */

const DEFAULT_INSPECTOR_WIDTH = 440;

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const traceItemTimeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export interface DatasetTraceDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Snapshot the trace lives in. Drives event lookup + dataset chip. */
  snapshot: DatasetSnapshot;
  /** Trace to inspect. When null/undefined, the panel collapses
   *  closed but keeps the last trace mounted for the duration of
   *  the slide-out animation. */
  trace: TraceSummary | null;
  /** Remove handler. When omitted, the Remove button is hidden. */
  onRemoveTrace?: RemoveTraceFromDatasetHandler;
  /** Optional secondary CTA — e.g. "Open in timeline" — that lets the
   *  parent navigate from the drawer to the full timeline tab. */
  onJumpToTimeline?: (traceId: string) => void;
  /** Inspector width in pixels. Defaults to {@link DEFAULT_INSPECTOR_WIDTH}. */
  width?: number;
  className?: string;
}

export function DatasetTraceDetailDrawer({
  isOpen,
  onClose,
  snapshot,
  trace,
  onRemoveTrace,
  onJumpToTimeline,
  width = DEFAULT_INSPECTOR_WIDTH,
  className,
}: DatasetTraceDetailDrawerProps) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [pending, setPending] = React.useState(false);
  /* Active event within the trace strip. Lets the user step through
     events without leaving the drawer. Defaults to the first event;
     resets when the underlying trace changes. */
  const [activeEventId, setActiveEventId] = React.useState<string | null>(
    null,
  );

  const [stickyTrace, setStickyTrace] = React.useState<TraceSummary | null>(
    trace,
  );
  React.useEffect(() => {
    if (trace) setStickyTrace(trace);
  }, [trace]);

  const visible = isOpen && trace !== null;

  React.useEffect(() => {
    if (!isOpen) {
      setConfirmOpen(false);
      setReason("");
      setPending(false);
    }
  }, [isOpen]);

  /* Esc-to-close, scoped to when the panel is showing so we don't
     swallow the key for other consumers. Skip when the confirm
     sub-dialog is open — Radix handles Escape there. */
  React.useEffect(() => {
    if (!visible || confirmOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, confirmOpen, onClose]);

  const renderTrace = trace ?? stickyTrace;
  const cluster = renderTrace?.clusterId
    ? snapshot.clusters.find((c) => c.id === renderTrace.clusterId) ?? null
    : null;

  const traceEvents = React.useMemo<readonly StreamTimelineEvent[]>(() => {
    if (!renderTrace) return [];
    return (snapshot.events ?? []).filter(
      (e) => e.traceId === renderTrace.traceId,
    );
  }, [snapshot.events, renderTrace]);

  /* Reset / clamp `activeEventId` when the trace changes or the
     active event vanishes (e.g. filter narrows it out). */
  React.useEffect(() => {
    if (traceEvents.length === 0) {
      setActiveEventId(null);
      return;
    }
    if (
      activeEventId &&
      traceEvents.some((e) => e.id === activeEventId)
    ) {
      return;
    }
    setActiveEventId(traceEvents[0]!.id);
  }, [traceEvents, activeEventId]);

  const activeIndex = activeEventId
    ? traceEvents.findIndex((e) => e.id === activeEventId)
    : -1;
  const activeEvent =
    activeIndex >= 0 ? traceEvents[activeIndex] ?? null : null;
  const prevEvent =
    activeIndex > 0 ? traceEvents[activeIndex - 1] ?? null : null;
  const nextEvent =
    activeIndex >= 0 && activeIndex < traceEvents.length - 1
      ? traceEvents[activeIndex + 1] ?? null
      : null;
  const hasEvents = traceEvents.length > 0;

  const handleRemove = async () => {
    if (!onRemoveTrace || !renderTrace) return;
    setPending(true);
    try {
      await onRemoveTrace({
        datasetId: snapshot.dataset.id,
        traceId: renderTrace.traceId,
        reason: reason.trim() || undefined,
      });
      setConfirmOpen(false);
      onClose();
    } finally {
      setPending(false);
    }
  };

  const sourceTint = renderTrace
    ? sourceTintedBackground(sourceColor(renderTrace.primarySource), 22)
    : "transparent";

  /* Per-source event tally driving the "Source breakdown" section.
     Computed from the snapshot's events filtered to this trace, so
     callers don't need to pass anything extra. Sorted desc by count
     so the heaviest source pins to the top. */
  const sourceCounts = React.useMemo<readonly [string, number][]>(() => {
    if (traceEvents.length === 0) return [];
    const counts = new Map<string, number>();
    for (const e of traceEvents) {
      counts.set(e.source, (counts.get(e.source) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [traceEvents]);

  const traceSources = renderTrace?.sources ?? [];
  const hasMultipleSources = traceSources.length >= 2;
  const showSourceBreakdown =
    hasMultipleSources && sourceCounts.length >= 2;

  const showFooterActions = !!(onJumpToTimeline || onRemoveTrace);

  return (
    <aside
      aria-label="Trace detail"
      aria-hidden={!visible}
      data-state={visible ? "open" : "closed"}
      className={cx(
        "shrink-0 self-stretch overflow-hidden border-l border-hairline bg-l-surface-bar",
        "transition-[width,opacity] duration-200 ease-out motion-reduce:transition-none",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
        className,
      )}
      style={{ width: visible ? width : 0 }}
    >
      {/* Inner pane is a fixed width so children don't reflow as the
         outer width animates. */}
      <div className="flex h-full flex-col bg-l-surface-bar text-l-ink" style={{ width }}>
        {renderTrace ? (
          <>
            <DetailHeader
              onClose={onClose}
              title={renderTrace.label}
              breadcrumb={
                <>
                  <SourceLogoStack
                    sources={
                      traceSources.length > 0
                        ? traceSources
                        : [renderTrace.primarySource]
                    }
                    size={12}
                    radius={2}
                  />
                  <span className="truncate font-sans text-[11.5px] text-l-ink-lo">
                    {cluster?.label ?? renderTrace.primarySource}
                    {hasMultipleSources && !cluster ? (
                      <span className="text-l-ink-dim">
                        {" "}
                        +{traceSources.length - 1} more
                      </span>
                    ) : null}
                  </span>
                </>
              }
              position={
                hasEvents
                  ? `${Math.max(activeIndex, 0) + 1} / ${traceEvents.length}`
                  : null
              }
              prevEvent={prevEvent ?? null}
              nextEvent={nextEvent ?? null}
              onPrev={prevEvent ? () => setActiveEventId(prevEvent.id) : undefined}
              onNext={nextEvent ? () => setActiveEventId(nextEvent.id) : undefined}
              copyId={renderTrace.traceId}
            />

            <div className="chron-scrollbar-hidden flex min-h-0 flex-1 flex-col overflow-y-auto">
              {hasEvents ? (
                <TraceStrip
                  events={traceEvents}
                  activeId={activeEventId}
                  traceLabel={cluster?.label ?? renderTrace.label}
                  onSelect={(e) => setActiveEventId(e.id)}
                />
              ) : null}

              {renderTrace.note ? (
                <Section eyebrow="Note">
                  <p className="rounded-[3px] border border-hairline bg-l-surface px-2.5 py-2 font-sans text-[12.5px] leading-snug text-l-ink-lo">
                    {renderTrace.note}
                  </p>
                </Section>
              ) : null}

              <Section eyebrow="Details">
                <DetailRow
                  label="Dataset"
                  icon={<Database size={12} strokeWidth={1.75} aria-hidden />}
                  value={
                    <span className="truncate text-l-ink">
                      {snapshot.dataset.name}
                    </span>
                  }
                />
                <DetailRow
                  label="Cluster"
                  icon={<LayersIcon size={12} strokeWidth={1.75} aria-hidden />}
                  value={
                    cluster ? (
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span
                          aria-hidden
                          className="size-1.5 shrink-0 rounded-pill"
                          style={{ background: cluster.color }}
                        />
                        <span className="truncate">{cluster.label}</span>
                      </span>
                    ) : (
                      <span className="text-l-ink-dim">Unclustered</span>
                    )
                  }
                />
                <DetailRow
                  label="Split"
                  icon={<GitBranch size={12} strokeWidth={1.75} aria-hidden />}
                  value={
                    renderTrace.split ? (
                      <DatasetSplitChip split={renderTrace.split} compact />
                    ) : (
                      <span className="text-l-ink-dim">—</span>
                    )
                  }
                />
                <DetailRow
                  label="Status"
                  icon={
                    <StatusIcon
                      status={renderTrace.status}
                      size={12}
                    />
                  }
                  value={
                    <span className={statusToneClass(renderTrace.status)}>
                      {statusLabel(renderTrace.status)}
                    </span>
                  }
                />
                <DetailRow
                  label={hasMultipleSources ? "Sources" : "Source"}
                  icon={
                    hasMultipleSources ? undefined : (
                      <CompanyLogo
                        name={renderTrace.primarySource}
                        size={14}
                        radius={3}
                        fallbackBackground={sourceTint}
                        fallbackColor="var(--c-ink-hi)"
                        aria-hidden
                      />
                    )
                  }
                  value={
                    hasMultipleSources ? (
                      <span className="flex min-w-0 items-center gap-2">
                        <SourceLogoStack
                          sources={traceSources}
                          size={14}
                          radius={3}
                        />
                        <span className="min-w-0 truncate">
                          <span className="text-l-ink">{traceSources[0]}</span>
                          {traceSources.length > 1 ? (
                            <span className="text-l-ink-lo">
                              , {traceSources.slice(1, 3).join(", ")}
                            </span>
                          ) : null}
                          {traceSources.length > 3 ? (
                            <span className="text-l-ink-dim">
                              {" "}
                              +{traceSources.length - 3} more
                            </span>
                          ) : null}
                        </span>
                      </span>
                    ) : (
                      renderTrace.primarySource
                    )
                  }
                />
                <DetailRow
                  label="Events"
                  icon={<Activity size={12} strokeWidth={1.75} aria-hidden />}
                  value={
                    <span className="font-mono tabular-nums text-l-ink">
                      {formatNumber(renderTrace.eventCount)}
                    </span>
                  }
                />
                <DetailRow
                  label="Duration"
                  icon={<Clock size={12} strokeWidth={1.75} aria-hidden />}
                  value={
                    <span className="font-mono tabular-nums text-l-ink">
                      {formatTraceDuration(renderTrace.durationMs)}
                    </span>
                  }
                />
                <DetailRow
                  label="Started"
                  icon={<Calendar size={12} strokeWidth={1.75} aria-hidden />}
                  value={
                    <span className="font-mono text-[12px] tabular-nums">
                      {formatStableDateTime(renderTrace.startedAt)}
                    </span>
                  }
                />
                {renderTrace.addedBy ? (
                  <DetailRow
                    label="Added by"
                    icon={<User size={12} strokeWidth={1.75} aria-hidden />}
                    value={renderTrace.addedBy}
                  />
                ) : null}
                <DetailRow
                  label="Trace ID"
                  icon={<Hash size={12} strokeWidth={1.75} aria-hidden />}
                  value={
                    <span className="inline-flex min-w-0 flex-1 items-center gap-1.5">
                      <span className="truncate font-mono text-[12px] text-l-ink-lo">
                        {renderTrace.traceId}
                      </span>
                      <CopyButton text={renderTrace.traceId} />
                    </span>
                  }
                />
              </Section>

              {showSourceBreakdown ? (
                <SourceBreakdownSection sourceCounts={sourceCounts} />
              ) : null}

              {activeEvent ? (
                <Section eyebrow="Active event">
                  <DetailRow
                    label="Type"
                    icon={
                      <Tag size={12} strokeWidth={1.75} aria-hidden />
                    }
                    value={
                      <span className="truncate font-mono text-[12px] text-l-ink">
                        {activeEvent.type}
                      </span>
                    }
                  />
                  <DetailRow
                    label="Time"
                    icon={
                      <Calendar size={12} strokeWidth={1.75} aria-hidden />
                    }
                    value={
                      <span className="font-mono text-[12px] tabular-nums">
                        {dateTimeFormatter.format(
                          new Date(activeEvent.occurredAt).getTime(),
                        )}
                      </span>
                    }
                  />
                  {activeEvent.actor ? (
                    <DetailRow
                      label="Actor"
                      icon={<User size={12} strokeWidth={1.75} aria-hidden />}
                      value={activeEvent.actor}
                    />
                  ) : null}
                  {activeEvent.correlationKey ? (
                    <DetailRow
                      label="Correlation"
                      icon={
                        <Fingerprint
                          size={12}
                          strokeWidth={1.75}
                          aria-hidden
                        />
                      }
                      value={
                        <span className="truncate font-mono text-[12px]">
                          {activeEvent.correlationKey}
                        </span>
                      }
                    />
                  ) : null}
                </Section>
              ) : null}
            </div>

            {showFooterActions ? (
              <footer className="flex shrink-0 items-center gap-2 border-t border-hairline bg-l-surface px-3 py-2">
                {onJumpToTimeline ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onPress={() => onJumpToTimeline(renderTrace.traceId)}
                  >
                    Open in timeline
                  </Button>
                ) : (
                  <span />
                )}
                {onRemoveTrace ? (
                  <Button
                    variant="critical"
                    size="sm"
                    className="ml-auto"
                    onPress={() => setConfirmOpen(true)}
                    leadingIcon={
                      <Trash2 className="size-3.5" strokeWidth={1.75} />
                    }
                  >
                    Remove from dataset
                  </Button>
                ) : null}
              </footer>
            ) : null}
          </>
        ) : null}
      </div>

      {/* Remove confirm sub-dialog. */}
      {renderTrace ? (
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
              <div className="rounded-[3px] border border-hairline-strong bg-l-surface-input px-3 py-2 font-sans text-[12px] text-l-ink">
                <div className="font-medium">{renderTrace.label}</div>
                <div className="mt-0.5 font-mono text-[11px] text-l-ink-dim">
                  {renderTrace.traceId} ·{" "}
                  {formatNumber(renderTrace.eventCount)} events
                </div>
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="font-sans text-[11px] font-medium text-l-ink-lo">
                  Reason (optional)
                </span>
                <Textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.currentTarget.value)}
                  placeholder="Duplicate of trace_xyz"
                />
              </label>
            </DialogBody>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost" size="sm">
                  Cancel
                </Button>
              </DialogClose>
              <Button
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
      ) : null}
    </aside>
  );
}

/* ── Header ───────────────────────────────────────────────── *
 * Mirrors `stream-event-detail.tsx`'s `<DetailHeader>` chrome —
 * compact 40 px row with a breadcrumb on top and a title + nav +
 * close on the bottom row. Close button bumps to 44 × 44 on
 * coarse pointers per Emil's touch-first principle.
 */

interface DetailHeaderProps {
  title?: React.ReactNode;
  breadcrumb?: React.ReactNode;
  position?: string | null;
  prevEvent?: StreamTimelineEvent | null;
  nextEvent?: StreamTimelineEvent | null;
  onPrev?: () => void;
  onNext?: () => void;
  copyId?: string;
  onClose?: () => void;
}

function DetailHeader({
  title,
  breadcrumb,
  position,
  prevEvent,
  nextEvent,
  onPrev,
  onNext,
  copyId,
  onClose,
}: DetailHeaderProps) {
  return (
    <header className="flex shrink-0 flex-col border-b border-hairline px-4 py-2.5">
      <div className="flex items-center gap-1.5">
        {breadcrumb ? (
          <div className="flex min-w-0 items-center gap-1.5">{breadcrumb}</div>
        ) : null}
        {position ? (
          <span className="font-mono text-[10.5px] tabular-nums text-l-ink-dim">
            · {position}
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-0.5">
          {prevEvent !== undefined || nextEvent !== undefined ? (
            <div className="mr-0.5 inline-flex items-center rounded-md border border-hairline bg-l-surface">
              <HeaderIconButton
                icon={
                  <ChevronLeft size={11} strokeWidth={1.75} aria-hidden />
                }
                disabled={!prevEvent}
                onClick={onPrev}
                ariaLabel="Previous event"
              />
              <HeaderIconButton
                icon={
                  <ChevronRight size={11} strokeWidth={1.75} aria-hidden />
                }
                disabled={!nextEvent}
                onClick={onNext}
                ariaLabel="Next event"
              />
            </div>
          ) : null}
          {copyId ? <CopyButton text={copyId} /> : null}
          {onClose ? (
            <HeaderIconButton
              icon={<X size={11} strokeWidth={1.75} aria-hidden />}
              onClick={onClose}
              ariaLabel="Close detail panel"
            />
          ) : null}
        </div>
      </div>
      {title ? (
        <p className="mt-1.5 truncate font-sans text-[14px] font-medium text-l-ink">
          {title}
        </p>
      ) : null}
    </header>
  );
}

function HeaderIconButton({
  icon,
  disabled,
  onClick,
  ariaLabel,
}: {
  icon: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cx(
        "inline-flex h-[22px] w-[22px] items-center justify-center rounded-xs",
        "touch-manipulation [@media(pointer:coarse)]:h-9 [@media(pointer:coarse)]:w-9",
        "text-l-ink-dim transition-colors duration-fast ease-out motion-reduce:transition-none",
        "hover:bg-l-wash-3 hover:text-l-ink",
        "disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-l-ink-dim",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember",
      )}
    >
      {icon}
    </button>
  );
}

/* ── Section + DetailRow ──────────────────────────────────── */

function Section({
  eyebrow,
  actions,
  children,
}: {
  eyebrow: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col border-b border-hairline px-3 py-3 last:border-b-0">
      <div className="mb-1.5 flex items-center px-1">
        <span className="font-sans text-[11.5px] font-medium text-l-ink-dim">
          {eyebrow}
        </span>
        <div className="ml-auto flex items-center gap-1">{actions}</div>
      </div>
      <div className="flex flex-col">{children}</div>
    </section>
  );
}

function DetailRow({
  label,
  icon,
  value,
}: {
  label: string;
  icon?: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <div className="group flex min-h-[28px] items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-l-wash-3">
      <span className="w-[88px] shrink-0 font-sans text-[12px] font-medium text-l-ink-dim">
        {label}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-2 font-sans text-[12px] text-l-ink">
        {icon ? (
          <span className="inline-flex h-[14px] w-[14px] shrink-0 items-center justify-center text-l-ink-dim">
            {icon}
          </span>
        ) : null}
        <span className="min-w-0 flex-1 truncate">{value}</span>
      </span>
    </div>
  );
}

/* ── Source breakdown ────────────────────────────────────── *
 * One mini-row per distinct source contributing events to the
 * trace — small CompanyLogo + name + tinted proportional bar +
 * tabular event count. Lets builders see at a glance which
 * integrations the trace touched and how much of the trace each
 * one accounts for, without leaving the inspector for a chart.
 */

interface SourceBreakdownSectionProps {
  /** Per-source counts pre-sorted desc by count. */
  sourceCounts: readonly [string, number][];
}

function SourceBreakdownSection({ sourceCounts }: SourceBreakdownSectionProps) {
  const total = sourceCounts.reduce((acc, [, n]) => acc + n, 0);
  if (total === 0) return null;
  return (
    <Section eyebrow="Source breakdown">
      <ul className="flex flex-col">
        {sourceCounts.map(([source, count]) => {
          const ratio = count / total;
          /* Min 4% so even tiny sources stay perceptible in the bar. */
          const widthPct = Math.max(4, Math.round(ratio * 100));
          const tint = sourceTintedBackground(sourceColor(source), 22);
          return (
            <li
              key={source}
              className="group flex min-h-[28px] items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-l-wash-3"
            >
              <CompanyLogo
                name={source}
                size={12}
                radius={2}
                fallbackBackground={tint}
                fallbackColor="var(--c-ink-hi)"
                aria-hidden
                className="shrink-0"
              />
              <span className="min-w-0 flex-1 truncate font-sans text-[12px] text-l-ink">
                {source}
              </span>
              <span
                aria-hidden
                className="relative h-[3px] w-[88px] shrink-0 overflow-hidden rounded-pill bg-l-wash-3"
              >
                <span
                  className="absolute inset-y-0 left-0 rounded-pill"
                  style={{
                    width: `${widthPct}%`,
                    background: sourceColor(source),
                  }}
                />
              </span>
              <span className="w-[36px] shrink-0 text-right font-mono text-[11px] tabular-nums text-l-ink-lo">
                {formatNumber(count)}
              </span>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/* ── Trace strip ──────────────────────────────────────────── */

interface TraceStripProps {
  events: readonly StreamTimelineEvent[];
  activeId: string | null;
  traceLabel: string | null;
  onSelect?: (event: StreamTimelineEvent) => void;
}

/**
 * Compact trace navigator. Identical visual to `StreamEventDetail`'s
 * `<TraceStrip>` so a builder switching between the timeline tab's
 * inspector and the dataset's outer trace inspector sees the same
 * affordance for stepping through events on a trace.
 */
function TraceStrip({
  events,
  activeId,
  traceLabel,
  onSelect,
}: TraceStripProps) {
  const listRef = React.useRef<HTMLOListElement | null>(null);

  React.useEffect(() => {
    const list = listRef.current;
    if (!list || !activeId) return;
    const active = list.querySelector<HTMLElement>(
      `[data-trace-event-id="${cssEscape(activeId)}"]`,
    );
    active?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeId]);

  return (
    <section className="flex flex-col border-b border-hairline px-3 py-3">
      <div className="mb-1.5 flex items-center gap-1.5 px-1">
        <GitBranch
          size={11}
          strokeWidth={1.75}
          className="text-event-violet"
          aria-hidden
        />
        <span className="truncate font-sans text-[11.5px] font-medium text-l-ink-dim">
          {traceLabel ?? "Trace"}
        </span>
        <span className="ml-auto font-mono text-[10.5px] tabular-nums text-l-ink-dim">
          {events.length} {events.length === 1 ? "event" : "events"}
        </span>
      </div>
      <ol
        ref={listRef}
        className="chron-scrollbar-hidden relative ml-2.5 mr-0.5 max-h-[180px] overflow-y-auto border-l border-hairline pb-0.5"
      >
        {events.map((e, idx) => {
          const isActive = e.id === activeId;
          const tint = sourceTintedBackground(sourceColor(e.source), 22);
          return (
            <li
              key={e.id}
              data-trace-event-id={e.id}
              className="relative -ml-px"
            >
              <span
                aria-hidden
                className={cx(
                  "absolute left-[-3px] top-2.5 inline-block size-1.5 rounded-pill",
                  isActive
                    ? "bg-ember ring-1 ring-ember/30 ring-offset-1 ring-offset-l-surface-bar"
                    : "bg-event-violet/60",
                )}
              />
              <button
                type="button"
                onClick={() => onSelect?.(e)}
                className={cx(
                  "flex w-full items-center gap-1.5 rounded-xs py-[3px] pl-3 pr-1.5 text-left",
                  "transition-colors duration-fast ease-out motion-reduce:transition-none",
                  "hover:bg-l-wash-3 focus-visible:bg-l-wash-3 focus-visible:outline-none",
                  isActive ? "bg-l-wash-3" : null,
                )}
              >
                <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-l-ink-dim">
                  {traceItemTimeFormatter.format(
                    new Date(e.occurredAt).getTime(),
                  )}
                </span>
                <CompanyLogo
                  name={e.source}
                  size={12}
                  radius={2}
                  fallbackBackground={tint}
                  fallbackColor="var(--c-ink-hi)"
                  className="shrink-0"
                  aria-hidden
                />
                <span
                  className={cx(
                    "min-w-0 truncate font-sans text-[12px]",
                    isActive ? "text-l-ink" : "text-l-ink-lo",
                  )}
                >
                  {e.type}
                </span>
                <span className="ml-auto shrink-0 font-mono text-[10px] tabular-nums text-l-ink-dim">
                  {idx + 1}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* ── Helpers ─────────────────────────────────────────────── */

function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
}

const STATUS_ICON: Record<TraceStatus, LucideIcon> = {
  ok: Activity,
  warn: Activity,
  error: Activity,
};

function StatusIcon({ status, size }: { status: TraceStatus; size: number }) {
  const Icon = STATUS_ICON[status];
  return (
    <Icon
      size={size}
      strokeWidth={1.75}
      className={statusToneClass(status)}
      aria-hidden
    />
  );
}

function statusToneClass(status: TraceStatus): string {
  switch (status) {
    case "ok":
      return "text-l-status-done";
    case "warn":
      return "text-l-status-inprogress";
    case "error":
      return "text-l-p-urgent";
  }
}

function statusLabel(status: TraceStatus): string {
  switch (status) {
    case "ok":
      return "OK";
    case "warn":
      return "Warn";
    case "error":
      return "Error";
  }
}
