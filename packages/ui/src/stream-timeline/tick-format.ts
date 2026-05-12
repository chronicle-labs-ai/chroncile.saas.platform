/*
 * Stream Timeline — tick-axis math.
 *
 * Pure helpers (no React, no DOM) that decide how many ticks to render
 * along the time axis given the current visible duration, and how to
 * label them. Extracted from `constants.ts` so the viewer can stay
 * declarative and the helpers can be unit-tested in isolation.
 */

/** Layout constants used by the viewer. */
export const HEADER_HEIGHT = 48;
export const DEFAULT_ROW_HEIGHT = 28;
export const DEFAULT_LABEL_WIDTH = 200;
export const INDENT_SIZE = 20;
export const MIN_HALF_WIDTH_MS = 1000;
export const MAX_HALF_WIDTH_MS = 7 * 24 * 60 * 60 * 1000;
/** Height of the major tick mark, hanging off the axis baseline. */
export const MAJOR_TICK_HEIGHT = 8;
/** Height of the minor tick mark. */
export const MINOR_TICK_HEIGHT = 4;

const MAX_TICKS = 17;

/** Tick interval in seconds for a given visible duration. */
export function getTickIntervalSeconds(durationMs: number): number {
  const secs = durationMs / 1000;
  if (secs <= 60) return 10;
  if (secs <= 300) return 30;
  if (secs <= 1800) return 60;
  if (secs <= 7200) return 3600;
  if (secs <= 14400) return 600;
  return 3600;
}

/** Tick interval in milliseconds, capped to ~17 ticks visible. */
export function getTickIntervalMs(durationMs: number): number {
  const base = getTickIntervalSeconds(durationMs) * 1000;
  const estimatedTicks = Math.ceil(durationMs / base);
  if (estimatedTicks <= MAX_TICKS) return base;
  return Math.ceil(durationMs / MAX_TICKS / 1000) * 1000;
}

/** Format a tick label appropriate to the current zoom. */
export function formatTickLabel(durationSecs: number, ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => n.toString().padStart(2, "0");
  const s = d.getSeconds();
  const m = d.getMinutes();
  const h = d.getHours();
  if (durationSecs <= 60) return pad(s);
  if (durationSecs <= 1800) return `${pad(m)}:${pad(s)}`;
  return `${pad(h)}:${pad(m)}`;
}

/** Tick "kind" — major ticks get a label and a longer mark. */
export type TickKind = "major" | "minor";

export interface TimelineTick {
  kind: TickKind;
  ms: number;
}

/**
 * How many minor ticks to subdivide each major interval into. Tuned to
 * the same duration thresholds as `getTickIntervalSeconds` so the
 * subdivisions land on round numbers (10s tick → two 5s subdivisions,
 * 1m tick → six 10s subdivisions, 1h tick → six 10m subdivisions).
 */
export function getMinorTickSubdivisions(durationMs: number): number {
  const secs = durationMs / 1000;
  if (secs <= 60) return 2; // 10s majors → 5s minors
  if (secs <= 300) return 3; // 30s majors → 10s minors
  if (secs <= 1800) return 4; // 1m majors → 15s minors
  if (secs <= 7200) return 6; // 1h majors → 10m minors
  if (secs <= 14400) return 5; // 10m majors → 2m minors
  return 4; // 1h majors → 15m minors
}

/**
 * Build a sorted list of major + minor ticks for the given visible
 * range. Major intervals come from `getTickIntervalMs`; minor ticks
 * subdivide each major interval evenly.
 */
export function computeTimelineTicks(
  startMs: number,
  endMs: number,
  durationMs: number,
): TimelineTick[] {
  if (durationMs <= 0) return [];
  const majorIntervalMs = getTickIntervalMs(durationMs);
  if (majorIntervalMs <= 0) return [];

  const subdivisions = Math.max(1, getMinorTickSubdivisions(durationMs));
  const minorIntervalMs = majorIntervalMs / subdivisions;

  const firstMinorMs =
    Math.floor(startMs / minorIntervalMs) * minorIntervalMs + minorIntervalMs;

  const out: TimelineTick[] = [];
  for (let t = firstMinorMs; t <= endMs; t += minorIntervalMs) {
    const remainder = Math.abs(t % majorIntervalMs);
    const isMajor =
      remainder < 0.5 || majorIntervalMs - remainder < 0.5;
    out.push({ kind: isMajor ? "major" : "minor", ms: t });
  }
  return out;
}

/**
 * Format the start/end of the visible range for the axis bookends. At
 * tight zooms we just show clock time; at wider zooms we include the
 * date so users have orientation when scrolling across days.
 */
export function formatRangeBookend(durationMs: number, ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => n.toString().padStart(2, "0");
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (durationMs <= 24 * 60 * 60 * 1000) return time;
  const month = d.toLocaleString(undefined, { month: "short" });
  return `${month} ${pad(d.getDate())} ${time}`;
}
