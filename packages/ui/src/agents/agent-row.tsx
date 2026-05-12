"use client";

import * as React from "react";
import { AlertTriangle, Bot, Check, MoreHorizontal, X } from "lucide-react";

import { cx } from "../utils/cx";
import { Button } from "../primitives/button";
import { formatNumber, RelativeTime } from "../connections/time";

import { AgentCompanyMark } from "./agent-company-mark";
import { AgentFrameworkBadge } from "./agent-framework-badge";
import { AgentVersionBadge } from "./agent-version-badge";
import { getModelProviderMeta } from "./framework-meta";
import type { AgentSummary } from "./types";

/*
 * AgentRow — list-view row companion to `AgentCard`. Two-line layout
 * tuned for purpose-led storytelling:
 *
 *   ──[logo]── name · v1.2.0 · [tag] [tag]   [framework]  v   r%/v   ok%   last  ⋯
 *             purpose line, truncated.
 *
 * Inline capability tags surface up to two storytelling chips next to
 * the name; the rest collapse into a +N indicator. Persona blurb is
 * intentionally absent on the row — that lives on the card and the
 * detail hero.
 */

export interface AgentRowProps {
  agent: AgentSummary;
  onOpen?: (name: string) => void;
  actionsSlot?: React.ReactNode;
  isActive?: boolean;
  className?: string;
}

const MAX_INLINE_TAGS = 2;

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
  const successLabel =
    successPct >= 95 ? "healthy" : successPct >= 80 ? "warning" : "failing";
  const SuccessIcon =
    successPct >= 95 ? Check : successPct >= 80 ? AlertTriangle : X;

  const tags = agent.capabilityTags ?? [];
  const inlineTags = tags.slice(0, MAX_INLINE_TAGS);
  const overflowTags = tags.length - inlineTags.length;
  const purpose = agent.purpose ?? agent.description;

  return (
    <div
      data-active={isActive || undefined}
      className={cx(
        "group relative isolate grid items-center gap-3 px-4",
        "grid-cols-[28px_minmax(0,2.4fr)_minmax(0,1fr)_72px_72px_64px_minmax(0,0.9fr)_28px]",
        "h-[52px] border-b border-l-border-faint last:border-b-0 first:rounded-t-[4px] last:rounded-b-[4px]",
        "font-sans text-[13px] text-l-ink",
        isActive
          ? "bg-l-surface-selected before:absolute before:left-0 before:top-1 before:bottom-1 before:z-10 before:w-[2px] before:bg-ember"
          : null,
        className,
      )}
    >
      {onOpen ? (
        <button
          type="button"
          aria-label={`Open agent ${agent.name}`}
          onClick={() => onOpen(agent.name)}
          className={cx(
            "absolute inset-0 z-0 cursor-pointer",
            "first:rounded-t-[3px] last:rounded-b-[3px]",
            "transition-colors duration-fast",
            "hover:bg-l-surface-hover",
            "focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-2px] focus-visible:outline-ember",
          )}
        />
      ) : null}

      <span className="pointer-events-none relative">
        <RowIdentityTile model={agent.model} />
      </span>

      <div className="pointer-events-none relative flex min-w-0 flex-col gap-[2px]">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-sans text-[13px] font-medium text-l-ink">
            {agent.name}
          </span>
          {inlineTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-[2px] border border-l-border-faint bg-l-wash-1 px-1.5 py-[1px] font-mono text-[10px] tabular-nums text-l-ink-lo"
            >
              {tag}
            </span>
          ))}
          {overflowTags > 0 ? (
            <span className="inline-flex items-center rounded-[2px] border border-dashed border-l-border-faint px-1.5 py-[1px] font-mono text-[10px] tabular-nums text-l-ink-dim">
              +{overflowTags}
            </span>
          ) : null}
        </span>
        {purpose ? (
          <span className="truncate font-sans text-[11px] leading-tight text-l-ink-dim">
            {purpose}
          </span>
        ) : null}
      </div>

      <span className="pointer-events-none relative flex min-w-0 items-center gap-1.5 truncate">
        <AgentFrameworkBadge framework={agent.framework} />
      </span>

      <span className="pointer-events-none relative text-right">
        <AgentVersionBadge version={agent.latestVersion} status="current" />
      </span>

      <span className="pointer-events-none relative text-right font-sans text-[12px] tabular-nums text-l-ink-lo">
        {formatNumber(agent.totalRuns)}
        <span className="ml-1 text-l-ink-dim">
          / {formatNumber(agent.versionCount)}v
        </span>
      </span>

      <span
        className={cx(
          "pointer-events-none relative inline-flex items-center justify-end gap-1 text-right font-sans text-[12px] tabular-nums",
          agent.totalRuns === 0 ? "text-l-ink-dim" : successTone,
        )}
      >
        {agent.totalRuns === 0 ? (
          "—"
        ) : (
          <>
            <SuccessIcon
              className="size-3 shrink-0"
              strokeWidth={2}
              aria-hidden
            />
            {`${successPct}%`}
            <span className="sr-only">{` (${successLabel})`}</span>
          </>
        )}
      </span>

      <span className="pointer-events-none relative flex min-w-0 items-center gap-1.5 truncate font-sans text-[11px] tabular-nums text-l-ink-dim">
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
        className="pointer-events-auto relative flex items-center justify-end"
        onClick={(e) => e.stopPropagation()}
      >
        {actionsSlot ?? (
          <Button
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
