"use client";

import * as React from "react";

import { cx } from "../utils/cx";
import { Sparkline } from "../primitives/sparkline";
import { CompanyLogo } from "../icons";
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
 * Activation pattern: the row uses a "stretched link" — a real
 * `<button>` is positioned absolutely behind the row's contents and
 * owns the `onOpen` click + keyboard activation. The contents (logo,
 * spans, badge, dropdown) sit in front via `relative z-[1]` so the
 * `⋯` menu, focus rings, and the sparkline still receive their own
 * pointer events. This replaces the previous `div role="button"`
 * pattern, which screen-readers announced as one giant button and
 * which broke text selection of the connection id.
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
  /** Callback fired when the row chrome (not the action menu) is clicked. */
  onOpen?: (id: string) => void;
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
  onReauth?: (id: string) => void;
  onTest?: (id: string) => void;
  onSettings?: (id: string) => void;
  onDisconnect?: (id: string) => void;
  /** Tone the row when it's the active one in the master/detail layout. */
  isActive?: boolean;
  /**
   * Hide the connection id in the subtitle. Defaults to `false`. The id is
   * useful for engineers but pushes the subtitle past the truncation point
   * on most viewports — opt out for production-like density.
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

export function ConnectionRow({
  connection,
  onOpen,
  onPause,
  onResume,
  onReauth,
  onTest,
  onSettings,
  onDisconnect,
  isActive,
  hideId,
  className,
}: ConnectionRowProps) {
  const src = getSource(connection.source);
  const titleId = React.useId();

  return (
    <div
      data-active={isActive || undefined}
      className={cx(
        "group relative isolate grid items-center gap-3 rounded-[2px] border border-divider bg-[rgba(255,255,255,0.012)] px-3 py-2.5",
        "transition-colors duration-fast",
        CONNECTION_ROW_GRID_TEMPLATE,
        onOpen
          ? "hover:bg-[rgba(255,255,255,0.025)] focus-within:bg-[rgba(255,255,255,0.025)]"
          : null,
        isActive ? "border-ember/35 bg-[rgba(216,67,10,0.045)]" : null,
        className,
      )}
    >
      {/*
       * Stretched-link overlay. Sits behind row contents (`z-0`); the
       * dropdown trigger and other interactive children are promoted to
       * `relative z-[1]` so they intercept their own pointer events.
       * `aria-labelledby` points at the connection name span so screen
       * readers announce "Stripe — open" instead of the whole row.
       */}
      {onOpen ? (
        <button
          type="button"
          aria-labelledby={titleId}
          onClick={() => onOpen(connection.id)}
          className="absolute inset-0 z-0 cursor-pointer rounded-[2px] outline-none focus-visible:ring-1 focus-visible:ring-ember/50"
        />
      ) : null}

      <span
        className="relative z-[1] flex h-9 w-9 items-center justify-center rounded-sm border border-hairline bg-surface-02"
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

      <div className="relative z-[1] flex min-w-0 flex-col gap-[2px]">
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
        className="relative z-[1]"
      />

      <div className="relative z-[1] flex min-w-0 flex-col gap-[2px]">
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

      <div className="relative z-[1] h-7 min-w-0">
        {connection.spark && connection.spark.length > 0 ? (
          <Sparkline
            values={connection.spark}
            tone={SPARK_TONE[connection.health]}
            height={28}
            width={140}
            className="h-7 w-full"
          />
        ) : (
          <span className="font-mono text-mono-sm text-ink-dim">—</span>
        )}
      </div>

      <span className="relative z-[1] font-mono text-mono-sm tabular-nums text-ink-dim">
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
        className="relative z-[1] flex items-center justify-end"
      />
    </div>
  );
}
