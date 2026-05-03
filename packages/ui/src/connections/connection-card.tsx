"use client";

import * as React from "react";

import { cx } from "../utils/cx";
import { Sparkline } from "../primitives/sparkline";
import { CompanyLogo } from "../icons";
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
 * Activation pattern: same stretched-link approach as `ConnectionRow`.
 * A real `<button>` is positioned absolutely behind the card contents
 * and owns `onOpen`; the actions menu sits in front via `relative
 * z-[1]` so its own click events still flow.
 */

export interface ConnectionCardProps {
  connection: Connection;
  onOpen?: (id: string) => void;
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
  onReauth?: (id: string) => void;
  onTest?: (id: string) => void;
  onSettings?: (id: string) => void;
  onDisconnect?: (id: string) => void;
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

export function ConnectionCard({
  connection,
  onOpen,
  onPause,
  onResume,
  onReauth,
  onTest,
  onSettings,
  onDisconnect,
  isActive,
  className,
}: ConnectionCardProps) {
  const src = getSource(connection.source);
  const titleId = React.useId();

  return (
    <div
      data-active={isActive || undefined}
      className={cx(
        "group relative isolate flex flex-col gap-3 rounded-[2px] border border-divider bg-[rgba(255,255,255,0.012)] p-4",
        "transition-colors duration-fast",
        onOpen
          ? "hover:bg-[rgba(255,255,255,0.025)] focus-within:bg-[rgba(255,255,255,0.025)]"
          : null,
        isActive ? "border-ember/35 bg-[rgba(216,67,10,0.045)]" : null,
        className,
      )}
    >
      {onOpen ? (
        <button
          type="button"
          aria-labelledby={titleId}
          onClick={() => onOpen(connection.id)}
          className="absolute inset-0 z-0 cursor-pointer rounded-[2px] outline-none focus-visible:ring-1 focus-visible:ring-ember/50"
        />
      ) : null}

      <div className="relative z-[1] flex items-start gap-3">
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
        />
      </div>

      <div className="relative z-[1] flex items-center justify-between">
        <ConnectionHealthBadge health={connection.health} size="sm" />
        <span className="font-mono text-mono-sm tabular-nums text-ink-dim">
          {connection.scopes.length}{" "}
          {connection.scopes.length === 1 ? "scope" : "scopes"}
        </span>
      </div>

      <div className="relative z-[1] flex items-baseline justify-between">
        <span className="font-display text-[22px] leading-none tracking-[-0.03em] tabular-nums text-ink-hi">
          {formatNumber(connection.eventsLast24h)}
        </span>
        <span className="font-mono text-mono-sm uppercase tracking-tactical text-ink-dim">
          / 24h
        </span>
      </div>

      <div className="relative z-[1] h-12">
        {connection.spark && connection.spark.length > 0 ? (
          <Sparkline
            values={connection.spark}
            tone={SPARK_TONE[connection.health]}
            height={48}
            width={240}
            className="h-12 w-full"
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
