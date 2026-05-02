"use client";

import * as React from "react";
import { AlertTriangle, Bot, MoreHorizontal } from "lucide-react";

import { cx } from "../utils/cx";
import { Button } from "../primitives/button";
import { formatNumber, RelativeTime } from "../connections/time";

import { AgentCompanyMark } from "./agent-company-mark";
import { AgentFrameworkBadge } from "./agent-framework-badge";
import { AgentVersionBadge } from "./agent-version-badge";
import { getModelProviderMeta } from "./framework-meta";
import type { AgentSummary } from "./types";

/*
 * AgentRow — list-view row companion to `AgentCard`. Linear-density
 * grid: 40px tall, 7-column layout for
 * name/framework/version/runs/success/last-run/actions.
 *
 * Type scale follows Linear's `small/medium` (13px Inter) for the
 * primary label and `micro/regular` (11px) for metadata, sitting on
 * the dark `bg-l-surface-raised` row chrome.
 */

export interface AgentRowProps {
  agent: AgentSummary;
  onOpen?: (name: string) => void;
  actionsSlot?: React.ReactNode;
  isActive?: boolean;
  className?: string;
}

export function AgentRow({
  agent,
  onOpen,
  actionsSlot,
  isActive,
  className,
}: AgentRowProps) {
  const successPct = Math.round(agent.successRate * 100);
  const successTone =
    successPct >= 95
      ? "text-event-green"
      : successPct >= 80
        ? "text-event-amber"
        : "text-event-red";

  return (
    <div
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={
        onOpen
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen(agent.name);
              }
            }
          : undefined
      }
      onClick={onOpen ? () => onOpen(agent.name) : undefined}
      data-active={isActive || undefined}
      className={cx(
        "group relative grid items-center gap-3 px-4",
        "grid-cols-[28px_minmax(0,2fr)_minmax(0,1fr)_72px_72px_64px_minmax(0,0.9fr)_28px]",
        "h-10 border-b border-l-border-faint last:border-b-0 first:rounded-t-[4px] last:rounded-b-[4px]",
        "font-sans text-[13px] text-l-ink",
        onOpen
          ? "cursor-pointer hover:bg-l-surface-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember/40"
          : null,
        isActive
          ? "bg-l-surface-selected before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[2px] before:bg-ember"
          : null,
        className,
      )}
    >
      <RowIdentityTile model={agent.model} />

      <div className="flex min-w-0 flex-col gap-[1px]">
        <span className="truncate font-sans text-[13px] font-medium text-l-ink">
          {agent.name}
        </span>
        {agent.description ? (
          <span className="truncate font-sans text-[11px] leading-tight text-l-ink-dim">
            {agent.description}
          </span>
        ) : null}
      </div>

      <span className="flex min-w-0 items-center gap-1.5 truncate">
        <AgentFrameworkBadge framework={agent.framework} />
      </span>

      <span className="text-right">
        <AgentVersionBadge version={agent.latestVersion} status="current" />
      </span>

      <span className="text-right font-sans text-[12px] text-l-ink-lo">
        {formatNumber(agent.totalRuns)}
        <span className="ml-1 text-l-ink-dim">
          / {formatNumber(agent.versionCount)}v
        </span>
      </span>

      <span
        className={cx(
          "text-right font-sans text-[12px]",
          agent.totalRuns === 0 ? "text-l-ink-dim" : successTone,
        )}
      >
        {agent.totalRuns === 0 ? "—" : `${successPct}%`}
      </span>

      <span className="flex min-w-0 items-center gap-1.5 truncate font-sans text-[11px] text-l-ink-dim">
        {agent.lastDriftAt ? (
          <>
            <AlertTriangle
              className="size-3 shrink-0 text-event-amber"
              strokeWidth={1.75}
            />
            <span className="truncate text-event-amber/80">
              drift · <RelativeTime iso={agent.lastDriftAt} fallback="—" />
            </span>
          </>
        ) : (
          <RelativeTime
            iso={agent.lastRunAt ?? new Date(0).toISOString()}
            fallback="—"
          />
        )}
      </span>

      <div
        className="flex items-center justify-end"
        onClick={(e) => e.stopPropagation()}
      >
        {actionsSlot ?? (
          <Button
            density="compact"
            variant="icon"
            size="sm"
            aria-label={`Actions for ${agent.name}`}
          >
            <MoreHorizontal className="size-4" strokeWidth={1.75} />
          </Button>
        )}
      </div>
    </div>
  );
}

function RowIdentityTile({ model }: { model: AgentSummary["model"] }) {
  const meta = getModelProviderMeta(model.provider);
  if (!meta) {
    return (
      <span
        aria-hidden
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[3px] bg-ember/10 text-ember"
      >
        <Bot className="size-3.5" strokeWidth={1.6} />
      </span>
    );
  }
  return (
    <AgentCompanyMark
      name={meta.companyName}
      domain={meta.companyDomain}
      size="sm"
      alt={`${meta.label} logo`}
      runtimeDetect={false}
    />
  );
}
