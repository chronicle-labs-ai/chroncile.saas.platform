"use client";

import * as React from "react";
import { cx } from "../utils/cx";
import { Priority, type PriorityLevel } from "../primitives/priority";

/**
 * TraceRow — one row in the Linear-style trace lane. Encodes:
 *
 *   ┌─ checkbox (optional, for bulk selection)
 *   │  ┌─ trace id (mono, dim)
 *   │  │  ┌─ priority glyph
 *   │  │  │  ┌─ avatar (initials)
 *   │  │  │  │  ┌─ title (sans, ink)
 *   │  │  │  │  │  ┌─ inline event spans (lane-colored)
 *   │  │  │  │  │  │  ┌─ trailing meta (count / duration)
 *   │  │  │  │  │  │  │  ┌─ assignee (avatar)
 *   │  │  │  │  │  │  │  │
 *
 * `onSelect` makes the row press-able and keyboard-focusable. Selection
 * via `selected` paints the row with the ember-tinted background and
 * left bar (the "one hot surface" rule).
 */

export interface TraceRowEventSpan {
  /** Lane key — maps to `--c-event-*` colors. */
  lane:
    | "teal"
    | "amber"
    | "green"
    | "orange"
    | "pink"
    | "violet"
    | "ember"
    | "red";
  /** Visual weight (1 = single dot, 2 = thin slug). */
  weight?: number;
}

export interface TraceRowProps
  extends Omit<
    React.HTMLAttributes<HTMLDivElement>,
    "onSelect" | "id" | "title"
  > {
  id: React.ReactNode;
  title: React.ReactNode;
  /** Priority glyph. */
  priority?: PriorityLevel;
  /** Tiny meta line under the title. Kept short — sub-meta only. */
  subMeta?: React.ReactNode;
  /** Lane-colored event spans rendered inline (the trace's "shape"). */
  events?: TraceRowEventSpan[];
  /** Trailing right-aligned meta (e.g. `3m 18s · 12 events`). */
  meta?: React.ReactNode;
  /** Assignee initials (single avatar bubble). */
  assignee?: React.ReactNode;
  /** Optional left checkbox slot for bulk selection. */
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
}

const laneColor: Record<TraceRowEventSpan["lane"], string> = {
  teal: "var(--c-event-teal)",
  amber: "var(--c-event-amber)",
  green: "var(--c-event-green)",
  orange: "var(--c-event-orange)",
  pink: "var(--c-event-pink)",
  violet: "var(--c-event-violet)",
  ember: "var(--c-ember)",
  red: "var(--c-event-red)",
};

function EventSpans({ spans }: { spans: TraceRowEventSpan[] }) {
  return (
    <span className="inline-flex items-center gap-[2px]">
      {spans.map((s, i) => (
        <span
          key={i}
          aria-hidden
          className="inline-block h-[10px] rounded-pill"
          style={{
            width: `${(s.weight ?? 1) * 8}px`,
            background: laneColor[s.lane],
            boxShadow: `0 0 0 1px var(--l-dot-edge)`,
          }}
        />
      ))}
    </span>
  );
}

export function TraceRow({
  id,
  title,
  priority,
  subMeta,
  events,
  meta,
  assignee,
  selectable,
  selected = false,
  onSelect,
  className,
  ...props
}: TraceRowProps) {
  return (
    <div
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect}
      onKeyDown={
        onSelect
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect();
              }
            }
          : undefined
      }
      data-selected={selected || undefined}
      className={cx(
        "relative grid h-[34px] items-center gap-s-3 px-s-5",
        "border-b border-l-border-faint",
        "outline-none transition-colors duration-fast",
        "hover:bg-l-wash-1 focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember",
        selected
          ? "bg-l-surface-selected before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[2px] before:bg-ember"
          : null,
        className,
      )}
      style={{
        gridTemplateColumns: selectable
          ? "16px 78px 16px 1fr auto auto 22px"
          : "78px 16px 1fr auto auto 22px",
      }}
      {...props}
    >
      {selectable ? (
        <span
          aria-hidden
          className="inline-block h-[14px] w-[14px] rounded-l-sm border border-l-border-strong"
        />
      ) : null}
      <span className="font-mono text-[11.5px] tracking-mono text-l-ink-dim">
        {id}
      </span>
      <Priority level={priority ?? "none"} />
      <div className="flex min-w-0 flex-col gap-[1px]">
        <div className="truncate text-[13px] text-l-ink">{title}</div>
        {subMeta ? (
          <div className="truncate font-mono text-[11px] text-l-ink-dim">
            {subMeta}
          </div>
        ) : null}
      </div>
      {events && events.length > 0 ? <EventSpans spans={events} /> : <span />}
      {meta ? (
        <span className="text-right font-mono text-[11px] text-l-ink-dim">
          {meta}
        </span>
      ) : (
        <span />
      )}
      {assignee ? (
        <span
          className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-pill text-[9px] font-semibold text-white"
          style={{
            background: "linear-gradient(135deg, #709188, #3e547c)",
          }}
        >
          {assignee}
        </span>
      ) : (
        <span />
      )}
    </div>
  );
}
