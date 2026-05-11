"use client";

import * as React from "react";

/*
 * Hydration-safe time + locale helpers for the dashboard
 * connections surface.
 *
 * The dashboard renders inside a Server Component layout, so anything
 * that depends on `Date.now()`, the user's locale, or the user's
 * timezone has to either:
 *
 *   1) render a stable placeholder on the server + first client tick
 *      and swap to the real value after mount (see `<RelativeTime>`)
 *   2) be computed with a fixed locale + timezone on both passes
 *      (see `formatStableDate*`, `formatNumber`)
 *
 * Anything else risks a hydration-mismatch error like
 *   "32m ago" (client) vs "31m ago" (server).
 */

/* ── useMounted ────────────────────────────────────────────── */

/**
 * Returns `false` on the server and on the very first client render
 * pass, then flips to `true` after the component has mounted. Use
 * to gate any output that depends on `Date.now()` / browser-only
 * APIs so SSR + first-paint markup matches.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  return mounted;
}

/* ── <RelativeTime> ────────────────────────────────────────── */

export interface RelativeTimeProps {
  /** ISO timestamp (e.g. "2026-05-01T13:02:14Z"). */
  iso: string;
  /** Placeholder rendered on server + first paint. Defaults to "". */
  fallback?: React.ReactNode;
  /**
   * Refresh interval in ms. Set to 0 (default) to compute once after
   * mount. Set higher for "live" relative tickers.
   */
  intervalMs?: number;
}

/**
 * Renders the relative offset between `iso` and `Date.now()` (e.g.
 * "31m ago"). Hydrates safely: on SSR + first client render returns
 * the `fallback`, then swaps to the formatted relative string after
 * mount.
 */
export function RelativeTime({
  iso,
  fallback = "",
  intervalMs = 0,
}: RelativeTimeProps) {
  const mounted = useMounted();
  const [, setTick] = React.useState(0);

  React.useEffect(() => {
    if (intervalMs <= 0) return;
    const id = window.setInterval(() => setTick((n) => n + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  if (!mounted) return <>{fallback}</>;
  return <>{formatRelative(iso)}</>;
}

export function formatRelative(iso: string): string {
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return "—";
  const diff = Date.now() - target;
  if (diff < 60_000) return "just now";
  const minutes = Math.round(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(diff / 3_600_000);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(diff / 86_400_000);
  return `${days}d ago`;
}

/* ── Stable date formatting ────────────────────────────────── */

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const TIME_FMT = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

const DATETIME_FMT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

/** Stable date string ("May 1, 2026"). Same on server and client. */
export function formatStableDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return DATE_FMT.format(d);
}

/** Stable wall time ("13:02:14"). Same on server and client. */
export function formatStableTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return TIME_FMT.format(d);
}

/** Stable combined date + time ("May 1, 2026, 13:02"). */
export function formatStableDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return DATETIME_FMT.format(d);
}

/* ── Stable number formatting ──────────────────────────────── */

const NUM_FMT = new Intl.NumberFormat("en-US");

/** Stable thousands-separator rendering ("14,328"). */
export function formatNumber(n: number): string {
  return NUM_FMT.format(n);
}
