"use client";

import * as React from "react";
import {
  MoreHorizontal,
  Pause,
  Play,
  RefreshCw,
  Settings,
  Activity,
  Trash2,
} from "lucide-react";

import { cx } from "../utils/cx";
import { Button } from "../primitives/button";
import { Sparkline } from "../primitives/sparkline";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSection,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../primitives/dropdown-menu";
import { CompanyLogo } from "../icons";
import { getSource } from "../onboarding/data";
import { ConnectionHealthBadge } from "./connection-health-badge";
import { type Connection } from "./data";
import { RelativeTime, formatNumber } from "./time";

/*
 * ConnectionRow — dense list row for the dashboard connections page.
 * Renders the source logo, name, category, health badge, last-event
 * relative ts, 24h event count + sparkline, scope count, and an
 * actions menu (Pause/Resume, Reauth, Test, Settings, Disconnect).
 *
 * Presentational: state lives at the boundary. Callbacks are all
 * optional — when omitted, the corresponding menu item is absent.
 */

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
  className,
}: ConnectionRowProps) {
  const src = getSource(connection.source);
  const isPaused = connection.health === "paused";
  const isErrored = connection.health === "error";
  const isExpired = connection.health === "expired";
  const showResume = isPaused && !!onResume;
  const showPause = !isPaused && !!onPause;
  const showReauth = (isExpired || isErrored) && !!onReauth;

  return (
    <div
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={
        onOpen
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen(connection.id);
              }
            }
          : undefined
      }
      onClick={onOpen ? () => onOpen(connection.id) : undefined}
      data-active={isActive || undefined}
      className={cx(
        "grid grid-cols-[36px_minmax(0,1.4fr)_120px_minmax(0,0.8fr)_minmax(0,0.7fr)_72px_36px]",
        "items-center gap-3 rounded-[2px] border border-divider bg-[rgba(255,255,255,0.012)] px-3 py-2.5",
        "transition-colors duration-fast",
        onOpen
          ? "cursor-pointer hover:bg-[rgba(255,255,255,0.025)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember/40"
          : null,
        isActive
          ? "border-ember/35 bg-[rgba(216,67,10,0.045)]"
          : null,
        className,
      )}
    >
      <span
        className="flex h-9 w-9 items-center justify-center rounded-sm border border-hairline bg-surface-02"
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

      <div className="flex min-w-0 flex-col gap-[2px]">
        <span className="truncate font-sans text-[13.5px] text-ink-hi">
          {connection.name}
        </span>
        <span className="truncate font-mono text-mono-sm text-ink-dim">
          {src?.cat ?? "—"} · {src?.auth ?? "—"} · {connection.id}
        </span>
      </div>

      <ConnectionHealthBadge health={connection.health} size="sm" />

      <div className="flex min-w-0 flex-col gap-[2px]">
        <span className="font-mono text-mono-sm text-ink-lo">
          {formatNumber(connection.eventsLast24h)}{" "}
          <span className="text-ink-dim">/24h</span>
        </span>
        <span className="truncate font-mono text-mono-sm text-ink-dim">
          last · <RelativeTime iso={connection.lastEventAt} fallback="—" />
        </span>
      </div>

      <div className="h-7 min-w-0">
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

      <span className="font-mono text-mono-sm text-ink-dim">
        {connection.scopes.length} {connection.scopes.length === 1 ? "scope" : "scopes"}
      </span>

      <div
        className="flex items-center justify-end"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button
              variant="icon"
              size="sm"
              aria-label={`Actions for ${connection.name}`}
            >
              <MoreHorizontal className="size-4" strokeWidth={1.75} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent density="compact" align="end">
            <DropdownMenuSection>
              {showResume ? (
                <DropdownMenuItem onAction={() => onResume?.(connection.id)}>
                  <Play className="size-4" strokeWidth={1.75} />
                  Resume
                </DropdownMenuItem>
              ) : null}
              {showPause ? (
                <DropdownMenuItem onAction={() => onPause?.(connection.id)}>
                  <Pause className="size-4" strokeWidth={1.75} />
                  Pause
                </DropdownMenuItem>
              ) : null}
              {showReauth ? (
                <DropdownMenuItem onAction={() => onReauth?.(connection.id)}>
                  <RefreshCw className="size-4" strokeWidth={1.75} />
                  Re-authorize
                </DropdownMenuItem>
              ) : null}
              {onTest ? (
                <DropdownMenuItem onAction={() => onTest?.(connection.id)}>
                  <Activity className="size-4" strokeWidth={1.75} />
                  Test connection
                </DropdownMenuItem>
              ) : null}
              {onSettings ? (
                <DropdownMenuItem onAction={() => onSettings?.(connection.id)}>
                  <Settings className="size-4" strokeWidth={1.75} />
                  Settings
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuSection>
            {onDisconnect ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  danger
                  onAction={() => onDisconnect?.(connection.id)}
                >
                  <Trash2 className="size-4" strokeWidth={1.75} />
                  Disconnect
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
