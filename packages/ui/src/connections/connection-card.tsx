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
import { formatNumber } from "./time";

/*
 * ConnectionCard — square tile variant for the dashboard's grid
 * view. Same data + actions as `ConnectionRow`, just laid out
 * vertically with a larger sparkline strip at the bottom.
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
        "group relative flex flex-col gap-3 rounded-[2px] border border-divider bg-[rgba(255,255,255,0.012)] p-4",
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
      <div className="flex items-start gap-3">
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
          <span className="truncate font-sans text-[14px] text-ink-hi">
            {connection.name}
          </span>
          <span className="truncate font-mono text-mono-sm text-ink-dim">
            {src?.cat ?? "—"} · {src?.auth ?? "—"}
          </span>
        </div>

        <div onClick={(e) => e.stopPropagation()}>
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

      <div className="flex items-center justify-between">
        <ConnectionHealthBadge health={connection.health} size="sm" />
        <span className="font-mono text-mono-sm text-ink-dim">
          {connection.scopes.length} {connection.scopes.length === 1 ? "scope" : "scopes"}
        </span>
      </div>

      <div className="flex items-baseline justify-between">
        <span className="font-display text-[22px] leading-none tracking-[-0.03em] text-ink-hi">
          {formatNumber(connection.eventsLast24h)}
        </span>
        <span className="font-mono text-mono-sm uppercase tracking-tactical text-ink-dim">
          / 24h
        </span>
      </div>

      <div className="h-12">
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
