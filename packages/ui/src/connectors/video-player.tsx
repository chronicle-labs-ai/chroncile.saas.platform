"use client";

import * as React from "react";
import { cx } from "../utils/cx";

/*
 * VideoPlayer — presentational chrome for the walkthrough clips that
 * sit alongside the connector modals. There is intentionally no
 * `<video>` element — the player is a static stand-in until the
 * marketing team ships the real clips. Drop in a `<video>` later by
 * swapping the `vp-frame` body for `<video controls>`.
 *
 * Visual structure:
 *   ┌──────────────────────────────────────────────────────────┐
 *   │  vp-frame  (16:9 surface, optional thumbnail bg)         │
 *   │    vp-play (centered ▶ button)                           │
 *   │    vp-cap  (caption overlay, top-left)                   │
 *   ├──────────────────────────────────────────────────────────┤
 *   │  vp-track (dotted progress + chapter markers)            │
 *   │  vp-meta  (current time / duration / chapter title)      │
 *   └──────────────────────────────────────────────────────────┘
 */

export interface VideoChapter {
  id: string;
  /** Position in fractional seconds (0–`duration`). */
  at: number;
  label: string;
}

export interface VideoPlayerProps {
  /** Display caption rendered top-left over the frame. */
  caption?: React.ReactNode;
  /** Total duration in seconds — drives the progress mock. */
  duration: number;
  /** Current playhead position in seconds. */
  current?: number;
  /** Chapter markers; positions are in seconds. */
  chapters?: readonly VideoChapter[];
  /** Render the play overlay button. Default true. */
  playable?: boolean;
  /** Optional poster URL. */
  poster?: string;
  /** Aspect ratio. Default `16/9`. */
  aspect?: "16/9" | "1/1" | "9/16";
  className?: string;
  /** Click handler for the play button (host wires to its real player). */
  onPlay?: () => void;
}

const fmt = (s: number) => {
  const mm = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${mm}:${ss.toString().padStart(2, "0")}`;
};

export function VideoPlayer({
  caption,
  duration,
  current = 0,
  chapters = [],
  playable = true,
  poster,
  aspect = "16/9",
  className,
  onPlay,
}: VideoPlayerProps) {
  const pct = duration > 0 ? Math.min(1, current / duration) : 0;
  const activeChapter = [...chapters]
    .sort((a, b) => b.at - a.at)
    .find((c) => current >= c.at);
  const aspectClass =
    aspect === "1/1"
      ? "aspect-square"
      : aspect === "9/16"
        ? "aspect-[9/16]"
        : "aspect-video";
  return (
    <div className={cx("vp-root", className)}>
      <div
        className={cx("vp-frame", aspectClass)}
        style={poster ? { backgroundImage: `url(${poster})` } : undefined}
      >
        {caption ? <div className="vp-cap">{caption}</div> : null}
        {playable ? (
          <button
            type="button"
            className="vp-play"
            onClick={onPlay}
            aria-label="Play walkthrough"
          >
            <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden>
              <path d="M6 4l14 8-14 8V4z" fill="currentColor" />
            </svg>
          </button>
        ) : null}
      </div>
      <div className="vp-track" role="progressbar" aria-valuenow={Math.round(pct * 100)}>
        <span className="vp-track-fill" style={{ width: `${pct * 100}%` }} />
        {chapters.map((c) => (
          <span
            key={c.id}
            className="vp-track-marker"
            data-active={activeChapter?.id === c.id || undefined}
            style={{ left: `${(c.at / duration) * 100}%` }}
            aria-label={c.label}
            title={c.label}
          />
        ))}
      </div>
      <div className="vp-meta">
        <span className="vp-time">
          {fmt(current)} <span className="vp-time-sep">/</span> {fmt(duration)}
        </span>
        {activeChapter ? (
          <span className="vp-chapter">{activeChapter.label}</span>
        ) : null}
      </div>
    </div>
  );
}
