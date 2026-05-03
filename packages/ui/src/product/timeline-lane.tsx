"use client";

import * as React from "react";
import { Priority, type PriorityLevel } from "../primitives/priority";
import { Status, type StatusKind } from "../primitives/status";
import { cx } from "../utils/cx";

export interface TimelineSource {
  id: string;
  label: string;
  color: string;
}

export interface TimelineEvent {
  id: string;
  traceId: string;
  source: string;
  op: string;
  timestampMs: number;
  preview: string;
  level?: "info" | "warn" | "error";
}

export interface TimelineSpan {
  id: string;
  traceId: string;
  source: string;
  op: string;
  startMs: number;
  durationMs: number;
  status?: "ok" | "warn" | "error";
  events: TimelineEvent[];
}

export interface TimelineTrace {
  id: string;
  title: string;
  customer?: string;
  customerInitials?: string;
  region?: string;
  priority?: PriorityLevel;
  status: StatusKind;
  outcome: "pass" | "partial" | "fail";
  startedAtMs: number;
  durationMs: number;
  spans: TimelineSpan[];
}

export type TimelineGroupBy = "none" | "outcome" | "customer";

export interface TimelineLaneProps extends React.HTMLAttributes<HTMLDivElement> {
  traces: TimelineTrace[];
  sources: TimelineSource[];
  /** Visible time window as 0-1 fractions of `durationMs`. */
  window?: [number, number];
  durationMs?: number;
  groupBy?: TimelineGroupBy;
  selectedTraceId?: string | null;
  selectedEventId?: string | null;
  onSelectTrace?: (traceId: string) => void;
  onSelectEvent?: (traceId: string, eventId: string) => void;
}

const outcomeLabel: Record<TimelineTrace["outcome"], string> = {
  fail: "Failed",
  partial: "Partial",
  pass: "Resolved",
};

const outcomeColor: Record<TimelineTrace["outcome"], string> = {
  fail: "var(--c-event-red)",
  partial: "var(--c-event-amber)",
  pass: "var(--c-event-green)",
};

export function TimelineLane({
  traces,
  sources,
  window: win = [0, 1],
  durationMs = 60 * 60 * 1000,
  groupBy = "none",
  selectedTraceId,
  selectedEventId,
  onSelectTrace,
  onSelectEvent,
  className,
  ...props
}: TimelineLaneProps) {
  const sourceById = React.useMemo(
    () => new Map(sources.map((source) => [source.id, source])),
    [sources]
  );
  const groups = React.useMemo(
    () => groupTraces(traces, groupBy),
    [traces, groupBy]
  );

  return (
    <div
      className={cx(
        "relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-l-surface",
        className
      )}
      {...props}
    >
      <TimelineRuler window={win} durationMs={durationMs} />
      <div className="min-h-0 flex-1 overflow-auto pt-[28px]">
        {groups.length === 0 ? (
          <div className="flex h-full items-center justify-center text-[13px] text-l-ink-dim">
            No traces match the current filters.
          </div>
        ) : (
          groups.map((group) => (
            <React.Fragment key={group.key}>
              {group.label ? (
                <div className="sticky top-0 z-10 flex h-[30px] items-center gap-s-2 border-b border-hairline-strong bg-l-surface-bar px-s-4 font-mono text-[10.5px] uppercase tracking-eyebrow text-l-ink-dim">
                  {group.outcome ? (
                    <Status kind={statusForOutcome(group.outcome)} />
                  ) : null}
                  <span>{group.label}</span>
                  <span className="rounded-xs bg-l-wash-3 px-[5px] py-[1px] text-l-ink-lo">
                    {group.traces.length}
                  </span>
                </div>
              ) : null}
              {group.traces.map((trace) => (
                <TimelineTraceRow
                  key={trace.id}
                  trace={trace}
                  sourceById={sourceById}
                  durationMs={durationMs}
                  window={win}
                  selectedTraceId={selectedTraceId}
                  selectedEventId={selectedEventId}
                  onSelectTrace={onSelectTrace}
                  onSelectEvent={onSelectEvent}
                />
              ))}
            </React.Fragment>
          ))
        )}
      </div>
    </div>
  );
}

function TimelineRuler({
  window: win,
  durationMs,
}: {
  window: [number, number];
  durationMs: number;
}) {
  const tickCount = 8;
  const span = win[1] - win[0];
  return (
    <div className="absolute left-0 right-0 top-0 z-20 grid h-[28px] grid-cols-[280px_1fr] border-b border-hairline-strong bg-l-surface-bar">
      <div className="flex items-center border-r border-hairline-strong px-s-4 font-mono text-[10.5px] uppercase tracking-eyebrow text-l-ink-dim">
        Trace
      </div>
      <div className="relative">
        {Array.from({ length: tickCount + 1 }, (_, i) => {
          const fraction = i / tickCount;
          const ms = (win[0] + fraction * span) * durationMs;
          return (
            <span
              key={i}
              className="absolute top-0 h-full border-l border-l-border-faint pl-[4px] font-mono text-[9.5px] leading-[28px] text-l-ink-dim"
              style={{ left: `${fraction * 100}%` }}
            >
              {i < tickCount ? formatClock(ms) : null}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function TimelineTraceRow({
  trace,
  sourceById,
  window: win,
  durationMs,
  selectedTraceId,
  selectedEventId,
  onSelectTrace,
  onSelectEvent,
}: {
  trace: TimelineTrace;
  sourceById: Map<string, TimelineSource>;
  window: [number, number];
  durationMs: number;
  selectedTraceId?: string | null;
  selectedEventId?: string | null;
  onSelectTrace?: (traceId: string) => void;
  onSelectEvent?: (traceId: string, eventId: string) => void;
}) {
  const selected = selectedTraceId === trace.id;
  const span = win[1] - win[0];
  const toPct = React.useCallback(
    (ms: number) => ((ms / durationMs - win[0]) / span) * 100,
    [durationMs, span, win]
  );

  const traceLeft = toPct(trace.startedAtMs);
  const traceRight = toPct(trace.startedAtMs + trace.durationMs);
  const envelopeVisible = traceRight > 0 && traceLeft < 100;
  const traceColor = outcomeColor[trace.outcome];

  return (
    <div
      role={onSelectTrace ? "button" : undefined}
      tabIndex={onSelectTrace ? 0 : undefined}
      onClick={() => onSelectTrace?.(trace.id)}
      onKeyDown={(event) => {
        if (!onSelectTrace) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelectTrace(trace.id);
        }
      }}
      data-selected={selected || undefined}
      className={cx(
        "grid min-h-[46px] grid-cols-[280px_1fr] border-b border-l-border-faint outline-none transition-colors duration-fast",
        "hover:bg-l-wash-1 focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember",
        selected ? "bg-l-surface-selected" : null
      )}
    >
      <div className="flex min-w-0 items-center gap-s-2 border-r border-l-border-faint px-s-4">
        <Status kind={trace.status} />
        <Priority level={trace.priority ?? "none"} />
        <span className="font-mono text-[11px] text-l-ink-dim">{trace.id}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] text-l-ink">{trace.title}</div>
          <div className="truncate font-mono text-[10.5px] text-l-ink-dim">
            {formatClock(trace.startedAtMs)} ·{" "}
            {formatDuration(trace.durationMs)}
            {trace.customer ? ` · ${trace.customer}` : null}
          </div>
        </div>
        {trace.customerInitials ? (
          <span className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-pill bg-[linear-gradient(135deg,#709188,#3e547c)] font-mono text-[9px] font-semibold text-white">
            {trace.customerInitials}
          </span>
        ) : null}
      </div>
      <div className="relative overflow-hidden">
        {envelopeVisible ? (
          <span
            aria-hidden
            className="absolute top-[11px] h-[24px] rounded-md border bg-[linear-gradient(90deg,var(--timeline-env-a),var(--timeline-env-b))]"
            style={
              {
                left: `${Math.max(0, traceLeft)}%`,
                right: `${100 - Math.min(100, traceRight)}%`,
                borderColor: traceColor,
                "--timeline-env-a": traceColor,
                "--timeline-env-b": "transparent",
                opacity: 0.42,
              } as React.CSSProperties
            }
          />
        ) : null}
        {trace.spans.map((timelineSpan) => {
          const source = sourceById.get(timelineSpan.source);
          const left = toPct(timelineSpan.startMs);
          const right = toPct(timelineSpan.startMs + timelineSpan.durationMs);
          if (right < -2 || left > 102) return null;
          return (
            <span
              key={timelineSpan.id}
              aria-hidden
              title={`${source?.label ?? timelineSpan.source} · ${timelineSpan.op}`}
              className="absolute top-[18px] h-[4px] rounded-pill"
              style={{
                left: `${Math.max(0, left)}%`,
                right: `${100 - Math.min(100, right)}%`,
                background: source?.color ?? "var(--l-ink-dim)",
                boxShadow:
                  timelineSpan.status === "error"
                    ? "0 0 0 1px var(--c-event-red)"
                    : undefined,
              }}
            />
          );
        })}
        {trace.spans.flatMap((timelineSpan) =>
          timelineSpan.events.map((event) => {
            const source = sourceById.get(event.source);
            const left = toPct(event.timestampMs);
            if (left < -2 || left > 102) return null;
            const isSelected = selectedEventId === event.id;
            return (
              <button
                key={event.id}
                type="button"
                aria-label={`${event.op}: ${event.preview}`}
                title={event.preview}
                onClick={(clickEvent) => {
                  clickEvent.stopPropagation();
                  onSelectEvent?.(trace.id, event.id);
                }}
                className={cx(
                  "absolute top-[15px] h-[10px] w-[10px] -translate-x-1/2 rounded-pill border outline-none",
                  "border-l-surface bg-l-ink-dim transition-transform duration-fast hover:scale-125",
                  "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember",
                  event.level === "error"
                    ? "shadow-[0_0_0_2px_var(--c-event-red)]"
                    : null,
                  event.level === "warn"
                    ? "shadow-[0_0_0_2px_var(--c-event-amber)]"
                    : null,
                  isSelected ? "scale-125 ring-2 ring-ember" : null
                )}
                style={{
                  left: `${left}%`,
                  background: source?.color ?? "var(--l-ink-dim)",
                }}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

interface TimelineGroup {
  key: string;
  label: string | null;
  outcome?: TimelineTrace["outcome"];
  traces: TimelineTrace[];
}

function groupTraces(
  traces: TimelineTrace[],
  groupBy: TimelineGroupBy
): TimelineGroup[] {
  if (groupBy === "outcome") {
    const order: TimelineTrace["outcome"][] = ["fail", "partial", "pass"];
    return order
      .map((outcome) => ({
        key: outcome,
        label: outcomeLabel[outcome],
        outcome,
        traces: traces.filter((trace) => trace.outcome === outcome),
      }))
      .filter((group) => group.traces.length > 0);
  }

  if (groupBy === "customer") {
    const byCustomer = new Map<string, TimelineTrace[]>();
    for (const trace of traces) {
      const key = trace.customer ?? "System";
      byCustomer.set(key, [...(byCustomer.get(key) ?? []), trace]);
    }
    return Array.from(byCustomer.entries()).map(([label, groupedTraces]) => ({
      key: label,
      label,
      traces: groupedTraces,
    }));
  }

  return [{ key: "all", label: null, traces }];
}

function statusForOutcome(outcome: TimelineTrace["outcome"]): StatusKind {
  if (outcome === "pass") return "done";
  if (outcome === "fail") return "canceled";
  return "inprogress";
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
}

function formatClock(ms: number): string {
  const base = new Date("2026-02-18T14:00:00Z").getTime();
  return new Date(base + ms).toISOString().slice(11, 16);
}
