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
import { RelativeTime, formatNumber } from "./time";

/*
 * ConnectionRow — dense list row for the dashboard connections page.
 * Renders the source logo, name, category, health badge, last-event
 * relative ts, 24h event count + sparkline, scope count, and an
 * actions menu (Pause/Resume, Reauth, Test, Settings, Disconnect).
 *
 * Activation pattern: a stretched `<a>` (or `<button>` when no `href`
 * is given) sits behind the row contents at `z-0`. Display-only
 * children get `pointer-events-none` so clicks fall through to the
 * activator — including clicks on text, the sparkline cell, and the
 * health badge. Only the actions menu, which has its own dropdown
 * trigger, lives at `z-[1]` with `pointer-events-auto` so it
 * intercepts its own clicks. The activator's `onClick` lets cmd /
 * ctrl / shift / middle-click fall through to the browser, so power
 * users get "open in new tab" semantics; plain click is intercepted
 * via `preventDefault` and routed to `onOpen` (drawer flow).
 *
 * Presentational: state lives at the boundary. Callbacks are all
 * optional — when omitted, the corresponding menu item is absent.
 */

/**
 * Grid template shared by `ConnectionRow` and any header rendered above
 * a stack of rows. Re-export and consume by reference so the row body
 * and the header can never silently drift out of alignment.
 */
export const CONNECTION_ROW_GRID_TEMPLATE =
  "grid-cols-[36px_minmax(0,1.4fr)_120px_minmax(0,0.8fr)_minmax(0,0.7fr)_72px_36px]";

export interface ConnectionRowProps {
  connection: Connection;
  /**
   * Canonical detail-page URL. When provided, the activator is an
   * `<a>` so cmd / ctrl / middle-click opens the page in a new tab;
   * plain click is intercepted and routed to `onOpen` (drawer flow).
   */
  href?: string;
  /** Callback fired when the row chrome (not the action menu) is clicked. */
  onOpen?: (id: string) => void;
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
  onReauth?: (id: string) => void;
  onTest?: (id: string) => void;
  onSettings?: (id: string) => void;
  onDisconnect?: (id: string) => void;
  /** Optional handler for the actions menu's "Open in new tab" item. */
  onOpenInNewTab?: (id: string) => void;
  /** Tone the row when it's the active one in the master/detail layout. */
  isActive?: boolean;
  /**
   * Hide the connection id in the subtitle. Defaults to `true`. The id
   * is still accessible via the actions menu's "Copy id" item, which
   * is the discoverable home for the rare engineer-style use case.
   */
  hideId?: boolean;
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

export function ConnectionRow({
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
  hideId = true,
  className,
}: ConnectionRowProps) {
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
        "group relative isolate grid items-center gap-3 rounded-[2px] border border-divider bg-wash-micro px-3 py-2.5",
        "transition-colors duration-fast",
        CONNECTION_ROW_GRID_TEMPLATE,
        onOpen || href
          ? "focus-within:bg-wash-2 hover:bg-wash-2"
          : null,
        isActive ? "border-ember/35 bg-[rgba(216,67,10,0.045)]" : null,
        className,
      )}
    >
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

      <span
        className="pointer-events-none relative z-[1] flex h-9 w-9 items-center justify-center rounded-sm border border-hairline bg-surface-02"
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

      <div className="pointer-events-none relative z-[1] flex min-w-0 flex-col gap-[2px]">
        <span
          id={titleId}
          className="truncate font-sans text-[13.5px] text-ink-hi"
        >
          {connection.name}
        </span>
        <span className="truncate font-mono text-mono-sm text-ink-dim">
          {src?.cat ?? "—"} · {src?.auth ?? "—"}
          {hideId ? null : <> · {connection.id}</>}
        </span>
      </div>

      <ConnectionHealthBadge
        health={connection.health}
        size="sm"
        className="pointer-events-none relative z-[1]"
      />

      <div className="pointer-events-none relative z-[1] flex min-w-0 flex-col gap-[2px]">
        <span className="font-mono text-mono-sm tabular-nums text-ink-lo">
          {formatNumber(connection.eventsLast24h)}{" "}
          <span className="text-ink-dim">/24h</span>
        </span>
        <span className="truncate font-mono text-mono-sm text-ink-dim">
          last ·{" "}
          <span className="tabular-nums">
            <RelativeTime iso={connection.lastEventAt} fallback="—" />
          </span>
        </span>
      </div>

      <div className="pointer-events-none relative z-[1] h-7 min-w-0">
        {connection.spark && connection.spark.length > 0 ? (
          <Sparkline
            values={connection.spark}
            tone={SPARK_TONE[connection.health]}
            height={28}
            width={140}
            className="h-7 w-full"
            aria-label={sparkLabel}
          />
        ) : (
          <span className="font-mono text-mono-sm text-ink-dim">—</span>
        )}
      </div>

      <span className="pointer-events-none relative z-[1] font-mono text-mono-sm tabular-nums text-ink-dim">
        {connection.scopes.length}{" "}
        {connection.scopes.length === 1 ? "scope" : "scopes"}
      </span>

      <ConnectionActionsMenu
        connection={connection}
        onPause={onPause}
        onResume={onResume}
        onReauth={onReauth}
        onTest={onTest}
        onSettings={onSettings}
        onDisconnect={onDisconnect}
        onOpenInNewTab={onOpenInNewTab}
        className="pointer-events-auto relative z-[1] flex items-center justify-end"
      />
    </div>
  );
}
