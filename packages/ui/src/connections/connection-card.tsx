"use client";

import * as React from "react";

import { cx } from "../utils/cx";
import { Sparkline } from "../primitives/sparkline";
import { CompanyLogo } from "../icons";
import { RouterLink } from "../layout/link-context";
import { getSource } from "../onboarding/data";
import { ConnectionActionsMenu } from "./connection-actions-menu";
import { ConnectionHealthBadge } from "./connection-health-badge";
import { type Connection } from "./data";
import { formatNumber } from "./time";

/*
 * ConnectionCard — square tile variant for the dashboard's grid view.
 * Same data + actions as `ConnectionRow`, just laid out vertically with
 * a larger sparkline strip at the bottom.
 *
 * Activation pattern: same as `ConnectionRow` — a stretched `<a>` (or
 * `<button>` fallback) sits at `z-0`, display-only children get
 * `pointer-events-none` so the activator catches their clicks, and
 * the actions menu lives at `z-[1]` with `pointer-events-auto` so
 * its dropdown trigger fires its own clicks. Cmd-click falls
 * through to the browser when an `href` is present.
 */

export interface ConnectionCardProps {
  connection: Connection;
  /**
   * Canonical detail-page URL. When provided, the activator is an
   * `<a>` so cmd / ctrl / middle-click opens the page in a new tab.
   */
  href?: string;
  onOpen?: (id: string) => void;
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
  onReauth?: (id: string) => void;
  onTest?: (id: string) => void;
  onSettings?: (id: string) => void;
  onDisconnect?: (id: string) => void;
  /** Optional handler for the actions menu's "Open in new tab" item. */
  onOpenInNewTab?: (id: string) => void;
  isActive?: boolean;
  className?: string;
}

const SPARK_TONE: Record<
  Connection["health"],
  React.ComponentProps<typeof Sparkline>["tone"]
> = {
  live: "green",
  paused: "amber",
  error: "red",
  expired: "amber",
  testing: "ember",
  disconnected: "ember",
};

function isModifiedClick(event: React.MouseEvent): boolean {
  return (
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.button !== 0
  );
}

function formatDelta(curr: number, prev: number | undefined): {
  label: string;
  tone: "up" | "down" | "flat";
} | null {
  if (prev === undefined || prev === null) return null;
  if (prev === 0 && curr === 0) return null;
  if (prev === 0) {
    // Avoid `Infinity%` — render as a flat "+" cue.
    return { label: "new traffic", tone: "up" };
  }
  const ratio = (curr - prev) / prev;
  const pct = Math.round(ratio * 100);
  if (pct === 0) return { label: "flat vs prev 24h", tone: "flat" };
  return {
    label: `${pct > 0 ? "+" : ""}${pct}% vs prev 24h`,
    tone: pct > 0 ? "up" : "down",
  };
}

export function ConnectionCard({
  connection,
  href,
  onOpen,
  onPause,
  onResume,
  onReauth,
  onTest,
  onSettings,
  onDisconnect,
  onOpenInNewTab,
  isActive,
  className,
}: ConnectionCardProps) {
  const src = getSource(connection.source);
  const titleId = React.useId();
  const sparkSummary = React.useMemo(() => {
    if (!connection.spark || connection.spark.length === 0) return null;
    const peak = Math.max(...connection.spark);
    const last = connection.spark[connection.spark.length - 1] ?? 0;
    return { peak, last };
  }, [connection.spark]);
  const sparkLabel = sparkSummary
    ? `Last 24h events for ${connection.name}: peak ${formatNumber(sparkSummary.peak)}, current ${formatNumber(sparkSummary.last)}.`
    : undefined;
  const delta = formatDelta(
    connection.eventsLast24h,
    connection.prevEventsLast24h,
  );

  const handleActivate = React.useCallback(
    (event: React.MouseEvent) => {
      if (isModifiedClick(event)) return;
      if (onOpen) {
        event.preventDefault();
        onOpen(connection.id);
      }
    },
    [onOpen, connection.id],
  );

  return (
    <div
      data-active={isActive || undefined}
      className={cx(
        "group relative isolate flex flex-col gap-3 rounded-[2px] border border-divider bg-wash-micro p-4",
        "transition-colors duration-fast",
        onOpen || href
          ? "focus-within:bg-wash-2 hover:bg-wash-2"
          : null,
        isActive ? "border-ember/35 bg-[rgba(216,67,10,0.045)]" : null,
        className,
      )}
    >
      {/*
       * Active-state accent stripe. A 2px ember bar pinned to the top
       * edge of the card so an active card can't be confused with a
       * hovered one in a dense grid (P1 finding).
       */}
      {isActive ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-[2] h-[2px] rounded-t-[2px] bg-ember"
        />
      ) : null}

      {href ? (
        <RouterLink
          href={href}
          prefetch={false}
          aria-labelledby={titleId}
          onClick={handleActivate}
          className="absolute inset-0 z-0 cursor-pointer rounded-[2px] outline-none focus-visible:ring-1 focus-visible:ring-ember/50"
        />
      ) : onOpen ? (
        <button
          type="button"
          aria-labelledby={titleId}
          onClick={() => onOpen(connection.id)}
          className="absolute inset-0 z-0 cursor-pointer rounded-[2px] outline-none focus-visible:ring-1 focus-visible:ring-ember/50"
        />
      ) : null}

      <div className="pointer-events-none relative z-[1] flex items-start gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-hairline bg-surface-02"
          aria-hidden
        >
          <CompanyLogo
            name={src?.name ?? connection.name}
            size={18}
            radius={4}
            fallbackBackground="var(--c-surface-02)"
            fallbackColor="var(--c-ink-dim)"
          />
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
          <span
            id={titleId}
            className="truncate font-sans text-[14px] text-ink-hi"
          >
            {connection.name}
          </span>
          <span className="truncate font-mono text-mono-sm text-ink-dim">
            {src?.cat ?? "—"} · {src?.auth ?? "—"}
          </span>
        </div>

        <ConnectionActionsMenu
          connection={connection}
          onPause={onPause}
          onResume={onResume}
          onReauth={onReauth}
          onTest={onTest}
          onSettings={onSettings}
          onDisconnect={onDisconnect}
          onOpenInNewTab={onOpenInNewTab}
          className="pointer-events-auto"
        />
      </div>

      <div className="pointer-events-none relative z-[1] flex items-center justify-between">
        <ConnectionHealthBadge health={connection.health} size="sm" />
        <span className="font-mono text-mono-sm tabular-nums text-ink-dim">
          {connection.scopes.length}{" "}
          {connection.scopes.length === 1 ? "scope" : "scopes"}
        </span>
      </div>

      <div className="pointer-events-none relative z-[1] flex items-baseline justify-between">
        <span className="font-display text-[22px] leading-none tracking-[-0.03em] tabular-nums text-ink-hi">
          {formatNumber(connection.eventsLast24h)}
        </span>
        <span className="font-mono text-mono-sm uppercase tracking-tactical text-ink-dim">
          / 24h
        </span>
      </div>

      {delta ? (
        <div
          className={cx(
            "pointer-events-none relative z-[1] -mt-2 font-mono text-mono-sm tabular-nums",
            delta.tone === "up"
              ? "text-event-green"
              : delta.tone === "down"
                ? "text-event-red"
                : "text-ink-dim",
          )}
        >
          {delta.label}
        </div>
      ) : null}

      <div className="pointer-events-none relative z-[1] h-12">
        {connection.spark && connection.spark.length > 0 ? (
          <Sparkline
            values={connection.spark}
            tone={SPARK_TONE[connection.health]}
            height={48}
            width={240}
            className="h-12 w-full"
            aria-label={sparkLabel}
          />
        ) : (
          <div className="flex h-12 items-center justify-center font-mono text-mono-sm text-ink-dim">
            no events
          </div>
        )}
      </div>
    </div>
  );
}
