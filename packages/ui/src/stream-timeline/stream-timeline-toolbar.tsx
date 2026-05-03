"use client";

import * as React from "react";
import {
  GitBranch,
  Layers,
  Maximize2,
  Pause,
  Play,
  X,
} from "lucide-react";

import { cx } from "../utils/cx";
import type { StreamPlaybackState } from "./types";

export type StreamTimelineGroupBy = "topic" | "trace";

export interface StreamTimelineToolbarProps {
  playback: StreamPlaybackState;
  /** Current playhead time in ms — rendered as a mono read-out on the right. */
  playheadMs: number;
  onPlaybackChange?: (next: StreamPlaybackState) => void;
  onFit?: () => void;
  /** When provided, renders the active-trace chip with a clear button. */
  activeTraceLabel?: string;
  /** Number of events on the active trace. */
  activeTraceCount?: number;
  /** Called when the user clears the active trace. */
  onClearActiveTrace?: () => void;
  /** When provided, renders a Topic / Trace segmented toggle. */
  groupBy?: StreamTimelineGroupBy;
  onGroupByChange?: (next: StreamTimelineGroupBy) => void;
  className?: string;
  /** Optional left-aligned slot (eyebrow / breadcrumb / title). */
  leading?: React.ReactNode;
  /** Optional right-aligned slot rendered before the read-out. */
  trailing?: React.ReactNode;
}

const TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  fractionalSecondDigits: 3,
  hour12: false,
});

/**
 * StreamTimelineToolbar — Linear-density player rail.
 *
 * Player buttons are intentionally kept tighter than the shared
 * `Button` primitive so icons read as small accents next to the
 * 12 px label rather than dominant glyphs. Sizing rules:
 *
 *   • Bar height:   32 px (8 × 4)
 *   • Button height: 24 px
 *   • Icon size:     11 px (`size={11}`) with `strokeWidth={1.75}`
 *   • Label size:    12 px sans, medium weight
 *   • Gap inside:    5 px (`gap-[5px]`)
 *
 * Live mode replaces the conventional Radio glyph with a 6 px
 * pulsing red dot — Linear-style — so the recording state reads as
 * an indicator, not a control.
 */
export function StreamTimelineToolbar({
  playback,
  playheadMs,
  onPlaybackChange,
  onFit,
  activeTraceLabel,
  activeTraceCount,
  onClearActiveTrace,
  groupBy,
  onGroupByChange,
  className,
  leading,
  trailing,
}: StreamTimelineToolbarProps) {
  const isPlaying = playback === "playing";
  const isLive = playback === "live";
  const showTraceChip = Boolean(activeTraceLabel);
  const showGroupBy = groupBy !== undefined && onGroupByChange !== undefined;

  return (
    <div
      className={cx(
        "flex h-8 items-center gap-[6px] border-b border-hairline bg-l-surface-bar px-[10px]",
        className,
      )}
    >
      {leading ? (
        <div className="mr-[2px] flex min-w-0 items-center gap-s-1 font-sans text-[12px] text-l-ink-lo">
          {leading}
        </div>
      ) : null}

      <PlayerButton
        active={isPlaying}
        ariaPressed={isPlaying}
        onClick={() =>
          onPlaybackChange?.(isPlaying ? "paused" : "playing")
        }
        icon={
          isPlaying ? (
            <Pause size={10} strokeWidth={2} aria-hidden />
          ) : (
            <Play
              size={10}
              strokeWidth={2}
              aria-hidden
              className="fill-current"
            />
          )
        }
        label={isPlaying ? "Pause" : "Play"}
      />

      <PlayerButton
        active={isLive}
        tone={isLive ? "ember" : "neutral"}
        ariaPressed={isLive}
        onClick={() => onPlaybackChange?.(isLive ? "paused" : "live")}
        icon={
          <span
            aria-hidden
            className={cx(
              "inline-block h-[6px] w-[6px] shrink-0 rounded-pill",
              isLive ? "animate-chron-pulse bg-event-red" : "bg-l-ink-dim",
            )}
          />
        }
        label="Live"
      />

      <PlayerButton
        onClick={onFit}
        icon={<Maximize2 size={11} strokeWidth={1.75} aria-hidden />}
        label="Fit"
      />

      {showGroupBy ? (
        <>
          <Divider />
          <SegmentedToggle
            options={[
              {
                value: "topic",
                label: "Topic",
                icon: <Layers size={11} strokeWidth={1.75} aria-hidden />,
              },
              {
                value: "trace",
                label: "Trace",
                icon: <GitBranch size={11} strokeWidth={1.75} aria-hidden />,
              },
            ]}
            value={groupBy}
            onChange={onGroupByChange}
          />
        </>
      ) : null}

      {showTraceChip ? (
        <>
          <Divider />
          <span
            className="inline-flex h-[22px] items-center gap-[5px] rounded-md border border-event-violet/30 bg-[rgba(139,92,246,0.08)] px-[7px] font-sans text-[11.5px] text-event-violet"
            data-trace-chip
          >
            <GitBranch size={10} strokeWidth={1.75} aria-hidden />
            <span className="truncate max-w-[160px]">{activeTraceLabel}</span>
            {activeTraceCount !== undefined ? (
              <span className="font-mono text-[10.5px] text-event-violet/70 tabular-nums">
                · {activeTraceCount}
              </span>
            ) : null}
            {onClearActiveTrace ? (
              <button
                type="button"
                onClick={onClearActiveTrace}
                aria-label="Clear active trace"
                className="ml-[2px] inline-flex h-[14px] w-[14px] items-center justify-center rounded-xs text-event-violet/70 transition-colors hover:bg-event-violet/15 hover:text-event-violet"
              >
                <X size={10} strokeWidth={1.75} aria-hidden />
              </button>
            ) : null}
          </span>
        </>
      ) : null}

      <div className="ml-auto flex items-center gap-s-2">
        {trailing}
        <span
          className="font-mono text-[11.5px] tracking-mono text-l-ink-lo tabular-nums"
          aria-label="Current playhead"
        >
          {TIME_FORMATTER.format(new Date(playheadMs))}
        </span>
      </div>
    </div>
  );
}

/* ── Player button ─────────────────────────────────────────── */

interface PlayerButtonProps {
  icon?: React.ReactNode;
  label?: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  ariaPressed?: boolean;
  tone?: "neutral" | "ember";
}

/**
 * Linear-tight toggle/action button for the player rail. Icons
 * stay small (10–11 px) so the label dominates and the button
 * reads as a verb, not a control panel.
 */
function PlayerButton({
  icon,
  label,
  onClick,
  active,
  ariaPressed,
  tone = "neutral",
}: PlayerButtonProps) {
  const isEmber = tone === "ember";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ariaPressed}
      data-active={active || undefined}
      className={cx(
        "inline-flex h-[24px] items-center gap-[5px] rounded-md border px-[8px]",
        "font-sans text-[12px] font-medium leading-none",
        "transition-colors duration-fast",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember focus-visible:ring-offset-1 focus-visible:ring-offset-page",
        active
          ? isEmber
            ? "border-ember/35 bg-[rgba(216,67,10,0.10)] text-ember hover:bg-[rgba(216,67,10,0.16)]"
            : "border-l-border-strong bg-l-surface-bar-2 text-l-ink"
          : "border-transparent text-l-ink-lo hover:bg-l-wash-3 hover:text-l-ink",
      )}
    >
      {icon ? (
        <span className="inline-flex shrink-0 items-center justify-center">
          {icon}
        </span>
      ) : null}
      {label}
    </button>
  );
}

/* ── Segmented toggle (Topic / Trace) ─────────────────────── */

interface SegmentedToggleOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly SegmentedToggleOption<T>[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Group by"
      className="inline-flex h-[24px] items-center rounded-md border border-hairline-strong bg-l-surface p-[1px]"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={cx(
              "inline-flex h-[20px] items-center gap-[4px] rounded-xs px-[7px]",
              "font-sans text-[11.5px] font-medium leading-none",
              "transition-colors duration-fast",
              active
                ? "bg-l-surface-bar-2 text-l-ink shadow-[inset_0_0_0_1px_var(--l-border)]"
                : "text-l-ink-lo hover:bg-l-wash-3 hover:text-l-ink",
            )}
          >
            {opt.icon ? (
              <span className="inline-flex shrink-0 items-center justify-center">
                {opt.icon}
              </span>
            ) : null}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function Divider() {
  return (
    <span
      aria-hidden
      className="mx-[2px] inline-block h-[14px] w-px bg-l-border"
    />
  );
}
