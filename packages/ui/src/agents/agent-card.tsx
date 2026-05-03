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
import type { AgentModelDescriptor, AgentSummary } from "./types";

/*
 * AgentCard — grid-view tile on the agents manager. The rewrite shifts
 * the card's job from "report KPIs" to "answer what this agent is".
 *
 * Layout (top → bottom):
 *
 *   ┌──────────────────────────────────────────────┐
 *   │  [logo]  agent-name  v1.2.0  [framework] [⋯] │
 *   │  Purpose line, one short sentence.           │
 *   │  Persona blurb, line-clamped to two lines.   │
 *   │  [Refunds] [Order lookup] [+2]               │
 *   │  ───────────────────────────────────────────  │
 *   │  92% ok · 1.2k runs · 4m ago · drift ↗       │
 *   └──────────────────────────────────────────────┘
 *
 * No layout shift across hover/active states; tabular-nums on every
 * number; consistent font weight regardless of selection.
 */

export interface AgentCardProps {
  agent: AgentSummary;
  onOpen?: (name: string) => void;
  actionsSlot?: React.ReactNode;
  isActive?: boolean;
  className?: string;
}

const MAX_INLINE_TAGS = 3;

export function AgentCard({
  agent,
  onOpen,
  actionsSlot,
  isActive,
  className,
}: AgentCardProps) {
  const successPct = Math.round(agent.successRate * 100);
  const successTone =
    agent.totalRuns === 0
      ? "text-l-ink-dim"
      : successPct >= 95
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
  const persona = agent.personaSummary;

  return (
    <div
      data-active={isActive || undefined}
      className={cx(
        "group relative isolate flex flex-col gap-3 rounded-[4px] border border-hairline-strong bg-l-surface-raised p-3.5",
        "transition-colors duration-fast",
        isActive ? "border-ember/45 bg-l-surface-selected" : null,
        className,
      )}
    >
      {onOpen ? (
        <button
          type="button"
          aria-label={`Open agent ${agent.name}`}
          onClick={() => onOpen(agent.name)}
          className={cx(
            "absolute inset-0 z-0 cursor-pointer rounded-[3px]",
            "transition-colors duration-fast",
            "hover:bg-l-surface-hover",
            "focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-2px] focus-visible:outline-ember",
          )}
        />
      ) : null}

      <div className="pointer-events-none relative flex items-start gap-3">
        <AgentIdentityTile model={agent.model} />

        <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
          <span className="flex items-center gap-2">
            <span className="truncate font-sans text-[13px] font-medium text-l-ink">
              {agent.name}
            </span>
            <AgentVersionBadge
              version={agent.latestVersion}
              status="current"
            />
          </span>
          <span className="flex items-center gap-1.5 truncate font-sans text-[11px] text-l-ink-dim">
            <AgentFrameworkBadge framework={agent.framework} />
            {agent.environment ? (
              <>
                <span aria-hidden>·</span>
                <span className="truncate">{agent.environment}</span>
              </>
            ) : null}
          </span>
        </div>

        <div className="pointer-events-auto" onClick={(e) => e.stopPropagation()}>
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

      {purpose ? (
        <p className="pointer-events-none relative line-clamp-2 font-sans text-[13px] leading-snug text-l-ink">
          {purpose}
        </p>
      ) : null}

      {persona ? (
        <p className="pointer-events-none relative line-clamp-2 font-sans text-[12px] leading-snug text-l-ink-lo">
          {persona}
        </p>
      ) : null}

      {inlineTags.length > 0 ? (
        <ul className="pointer-events-none relative flex flex-wrap items-center gap-1.5">
          {inlineTags.map((tag) => (
            <li
              key={tag}
              className="inline-flex items-center rounded-[2px] border border-l-border-faint bg-l-wash-1 px-1.5 py-[1px] font-mono text-[10px] tabular-nums text-l-ink-lo"
            >
              {tag}
            </li>
          ))}
          {overflowTags > 0 ? (
            <li className="inline-flex items-center rounded-[2px] border border-dashed border-l-border-faint px-1.5 py-[1px] font-mono text-[10px] tabular-nums text-l-ink-dim">
              +{overflowTags}
            </li>
          ) : null}
        </ul>
      ) : null}

      <div className="pointer-events-none relative mt-auto flex items-center justify-between gap-2 border-t border-l-border-faint pt-2.5 font-sans text-[11px] tabular-nums text-l-ink-dim">
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            className={cx("inline-flex items-center gap-1", successTone)}
          >
            {agent.totalRuns === 0 ? (
              <span className="text-l-ink-dim">—</span>
            ) : (
              <>
                <SuccessIcon
                  className="size-3 shrink-0"
                  strokeWidth={2}
                  aria-hidden
                />
                <span className="font-medium">{`${successPct}% ok`}</span>
                <span className="sr-only">{` (${successLabel})`}</span>
              </>
            )}
          </span>
          <span aria-hidden>·</span>
          <span>{formatNumber(agent.totalRuns)} runs</span>
          <span aria-hidden>·</span>
          {agent.lastRunAt ? (
            <RelativeTime iso={agent.lastRunAt} fallback="—" />
          ) : (
            <span>no runs yet</span>
          )}
        </span>
        {agent.lastDriftAt ? (
          <span className="flex shrink-0 items-center gap-1 text-event-amber">
            <AlertTriangle
              className="size-3 shrink-0"
              strokeWidth={1.75}
              aria-hidden
            />
            <span>
              drift · <RelativeTime iso={agent.lastDriftAt} fallback="—" />
            </span>
          </span>
        ) : agent.owner ? (
          <span className="shrink-0 truncate font-mono text-l-ink-dim">
            {agent.owner}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Leading 36px tile rendered to the left of the agent name. Shows the
 * model-provider company logo (with a tone-aware tile so dark marks
 * stay visible on the dark canvas) when known, falling back to a
 * generic Bot glyph in an ember tile.
 */
function AgentIdentityTile({ model }: { model: AgentModelDescriptor }) {
  const meta = getModelProviderMeta(model.provider);
  if (!meta) {
    return (
      <span
        aria-hidden
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[3px] bg-ember/10 text-ember"
      >
        <Bot className="size-4" strokeWidth={1.6} />
      </span>
    );
  }
  return (
    <AgentCompanyMark
      name={meta.companyName}
      domain={meta.companyDomain}
      size="md"
      alt={`${meta.label} logo`}
    />
  );
}
