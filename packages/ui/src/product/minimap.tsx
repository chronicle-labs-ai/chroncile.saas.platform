"use client";

import * as React from "react";
import { cx } from "../utils/cx";

/**
 * Minimap — the event-stream minimap strip with a scrub track, optional
 * replay range window, and an ember playhead. Bars are computed
 * deterministically from seed values so the visual is stable.
 *
 * Two density flavors:
 *
 *   density="brand" (default)   — original 64 px tall replay strip with
 *                                  play/pause + readouts. Used in Page
 *                                  06's `AppShell` footer slot.
 *
 *   density="compact"           — slim 56 px Linear-style timeline minimap
 *                                  with a draggable window (`window`,
 *                                  `onWindowChange`), bins, ruler, and
 *                                  shaded rest-of-track. Used at the top
 *                                  of the Linear timeline canvas.
 */
export type MinimapDensity = "brand" | "compact";

export interface MinimapBar {
  /** 0–100 height percentage. */
  height: number;
  /** Event lane color. Accepts any CSS color. */
  color: string;
  /** 0–1 opacity. */
  opacity?: number;
}

export interface MinimapProps extends React.HTMLAttributes<HTMLDivElement> {
  bars: MinimapBar[];
  /** 0–100 — position of the playhead. Only used in `density="brand"`. */
  playhead?: number;
  /** Optional replay window — `[start, end]` as 0–100 percentages. */
  range?: [number, number];
  /**
   * Compact-only draggable window. `[start, end]` as 0–1 fractions.
   * When `onWindowChange` is provided, the user can drag the window
   * itself to pan and either edge to resize.
   */
  window?: [number, number];
  onWindowChange?: (next: [number, number]) => void;
  /** Compact-only ruler ticks (rendered as labeled marks below the track). */
  rulerLabels?: React.ReactNode[];
  /** Content for the left/right readouts. */
  readoutLeft?: React.ReactNode;
  readoutRight?: React.ReactNode;
  /** Playback button hit-area. Pass null to hide. Brand density only. */
  onPlay?: () => void;
  playing?: boolean;
  /** Optional speed selector slot. Brand density only. */
  speed?: React.ReactNode;
  density?: MinimapDensity;
}

export function Minimap({
  bars,
  playhead = 0,
  range,
  window: win,
  onWindowChange,
  rulerLabels,
  readoutLeft,
  readoutRight,
  onPlay,
  playing = false,
  speed,
  density = "brand",
  className,
  ...props
}: MinimapProps) {
  if (density === "compact") {
    return (
      <CompactMinimap
        bars={bars}
        win={win ?? [0, 1]}
        onWindowChange={onWindowChange}
        rulerLabels={rulerLabels}
        readoutLeft={readoutLeft}
        readoutRight={readoutRight}
        className={className}
        {...props}
      />
    );
  }

  const clamped = Math.max(0, Math.min(100, playhead));
  return (
    <div
      className={cx(
        "col-span-full flex h-[64px] items-center gap-s-3 border-t border-hairline bg-surface-01 px-s-6",
        className
      )}
      {...props}
    >
      {onPlay !== undefined ? (
        <button
          type="button"
          onClick={onPlay}
          aria-label={playing ? "Pause" : "Play"}
          className="inline-flex h-[32px] w-[32px] items-center justify-center rounded-full border-0 bg-ink-hi text-[11px] text-[color:var(--c-btn-invert-fg)]"
        >
          {playing ? "⏸" : "▶"}
        </button>
      ) : null}
      {readoutLeft ? (
        <div className="whitespace-nowrap font-mono text-mono-lg tracking-mono text-ink-lo">
          {readoutLeft}
        </div>
      ) : null}
      <div className="relative flex h-[38px] flex-1 items-end overflow-hidden rounded-xs border border-hairline bg-surface-00">
        <div className="absolute inset-[4px] flex items-end gap-px">
          {bars.map((b, i) => (
            <span
              key={i}
              className="inline-block w-[2px]"
              style={{
                height: `${Math.max(0, Math.min(100, b.height))}%`,
                background: b.color,
                opacity: b.opacity ?? 1,
              }}
            />
          ))}
        </div>
        {range ? (
          <span
            className="absolute bottom-0 top-0 bg-[rgba(139,92,246,0.1)] border-l border-r border-event-violet"
            style={{
              left: `${range[0]}%`,
              width: `${Math.max(0, range[1] - range[0])}%`,
            }}
          />
        ) : null}
        <span
          className="pointer-events-none absolute bottom-0 top-0 w-[2px] bg-ember shadow-glow-ember"
          style={{ left: `${clamped}%` }}
        >
          <span className="absolute -top-[6px] -left-[5px] h-[12px] w-[12px] rounded-full bg-ember" />
        </span>
      </div>
      {readoutRight ? (
        <div className="whitespace-nowrap font-mono text-mono-lg tracking-mono text-ink-lo">
          {readoutRight}
        </div>
      ) : null}
      {speed}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CompactMinimap — Linear-density timeline minimap with draggable
// window. Lives at the top of the timeline canvas (not the footer).
// ─────────────────────────────────────────────────────────────

interface CompactMinimapProps extends React.HTMLAttributes<HTMLDivElement> {
  bars: MinimapBar[];
  win: [number, number];
  onWindowChange?: (next: [number, number]) => void;
  rulerLabels?: React.ReactNode[];
  readoutLeft?: React.ReactNode;
  readoutRight?: React.ReactNode;
}

function CompactMinimap({
  bars,
  win,
  onWindowChange,
  rulerLabels,
  readoutLeft,
  readoutRight,
  className,
  ...props
}: CompactMinimapProps) {
  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const dragRef = React.useRef<{
    mode: "move" | "left" | "right";
    startPct: number;
    win: [number, number];
  } | null>(null);

  const startDrag =
    (mode: "move" | "left" | "right") => (e: React.MouseEvent) => {
      if (!onWindowChange || !trackRef.current) return;
      const r = trackRef.current.getBoundingClientRect();
      const startPct = (e.clientX - r.left) / r.width;
      dragRef.current = { mode, startPct, win };

      const onMove = (ev: MouseEvent) => {
        if (!trackRef.current || !dragRef.current) return;
        const r2 = trackRef.current.getBoundingClientRect();
        const p = (ev.clientX - r2.left) / r2.width;
        const w = dragRef.current.win;
        if (dragRef.current.mode === "move") {
          const delta = p - dragRef.current.startPct;
          const width = w[1] - w[0];
          const ns = Math.max(0, Math.min(1 - width, w[0] + delta));
          onWindowChange([ns, ns + width]);
        } else if (dragRef.current.mode === "left") {
          onWindowChange([Math.min(w[1] - 0.02, Math.max(0, p)), w[1]]);
        } else {
          onWindowChange([w[0], Math.max(w[0] + 0.02, Math.min(1, p))]);
        }
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        dragRef.current = null;
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    };

  const winLeftPct = `${win[0] * 100}%`;
  const winWidthPct = `${(win[1] - win[0]) * 100}%`;

  return (
    <div
      data-density="compact"
      className={cx(
        "flex flex-col gap-[6px] border-b border-l-border bg-l-surface px-s-4 py-[10px]",
        className
      )}
      {...props}
    >
      <div className="flex items-center font-mono text-[10.5px] uppercase tracking-eyebrow text-l-ink-dim">
        {readoutLeft ? <span>{readoutLeft}</span> : null}
        <span className="flex-1" />
        {readoutRight ? <span>{readoutRight}</span> : null}
      </div>
      <div
        ref={trackRef}
        className="relative h-[36px] overflow-hidden rounded-l-sm bg-l-wash-1"
      >
        <div className="absolute inset-x-0 bottom-[10px] flex h-[26px] items-end gap-px px-[2px]">
          {bars.map((b, i) => (
            <span
              key={i}
              className="inline-block flex-1"
              style={{
                height: `${Math.max(2, Math.min(100, b.height))}%`,
                background: b.color,
                opacity: b.opacity ?? 0.85,
              }}
            />
          ))}
        </div>
        {/* Shaded rest-of-track */}
        <span
          aria-hidden
          className="absolute top-0 bottom-0 left-0 bg-[var(--l-shade-overlay)]"
          style={{ width: winLeftPct }}
        />
        <span
          aria-hidden
          className="absolute top-0 bottom-0 right-0 bg-[var(--l-shade-overlay)]"
          style={{ width: `${(1 - win[1]) * 100}%` }}
        />
        {/* Draggable window */}
        <div
          role={onWindowChange ? "slider" : undefined}
          aria-label={onWindowChange ? "Timeline window" : undefined}
          onMouseDown={onWindowChange ? startDrag("move") : undefined}
          className={cx(
            "absolute top-0 bottom-0 border border-ember",
            onWindowChange ? "cursor-move" : null
          )}
          style={{ left: winLeftPct, width: winWidthPct }}
        >
          {onWindowChange ? (
            <>
              <span
                role="separator"
                aria-label="Resize window start"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  startDrag("left")(e);
                }}
                className="absolute -left-[3px] top-0 bottom-0 w-[6px] cursor-ew-resize"
              />
              <span
                role="separator"
                aria-label="Resize window end"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  startDrag("right")(e);
                }}
                className="absolute -right-[3px] top-0 bottom-0 w-[6px] cursor-ew-resize"
              />
            </>
          ) : null}
        </div>
        {rulerLabels && rulerLabels.length > 0 ? (
          <div className="pointer-events-none absolute inset-x-[2px] bottom-0 flex justify-between font-mono text-[9px] text-l-ink-dim">
            {rulerLabels.map((l, i) => (
              <span key={i}>{l}</span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Deterministic-ish fake bars used by stories and fixtures. */
export function generateMinimapBars(count = 260): MinimapBar[] {
  const colors = [
    "var(--c-event-teal)",
    "var(--c-event-amber)",
    "var(--c-event-green)",
    "var(--c-event-orange)",
    "var(--c-event-pink)",
    "var(--c-ink-dim)",
    "var(--c-ink-dim)",
  ];
  const bars: MinimapBar[] = [];
  for (let i = 0; i < count; i++) {
    const h = 18 + Math.round(Math.sin(i * 0.23) * 10 + ((i * 7) % 14));
    bars.push({
      height: h,
      color: colors[i % colors.length]!,
      opacity: i > 100 && i < 230 ? 1 : 0.35,
    });
  }
  return bars;
}
