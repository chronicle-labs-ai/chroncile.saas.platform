"use client";

import * as React from "react";
import { AlertTriangle, Bot, MoreHorizontal } from "lucide-react";

import { cx } from "../utils/cx";
import { Button } from "../primitives/button";
import { formatNumber, RelativeTime } from "../connections/time";

import { AgentCompanyMark } from "./agent-company-mark";
import { AgentFrameworkBadge } from "./agent-framework-badge";
import { AgentModelLabel } from "./agent-model-label";
import { AgentVersionBadge } from "./agent-version-badge";
import { getModelProviderMeta } from "./framework-meta";
import type { AgentModelDescriptor, AgentSummary } from "./types";

/*
 * AgentCard — grid-view tile on the agents manager. Shows the agent
 * identity (name + framework metadata), its latest pinned version, a
 * one-line health summary (success rate, runs in window, last drift),
 * and the model label.
 *
 * Linear-density: no shadow, 1px hairline, 4px radius, ember tint
 * when the row is selected.
 */

export interface AgentCardProps {
  agent: AgentSummary;
  onOpen?: (name: string) => void;
  actionsSlot?: React.ReactNode;
  isActive?: boolean;
  className?: string;
}

export function AgentCard({
  agent,
  onOpen,
  actionsSlot,
  isActive,
  className,
}: AgentCardProps) {
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
        "group relative flex flex-col gap-3 rounded-[4px] border border-l-border bg-l-surface-raised p-3.5",
        "transition-colors duration-fast",
        onOpen
          ? "cursor-pointer hover:bg-l-surface-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember/40"
          : null,
        isActive ? "border-ember/45 bg-l-surface-selected" : null,
        className,
      )}
    >
      <div className="flex items-start gap-3">
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

        <div onClick={(e) => e.stopPropagation()}>
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

      {agent.description ? (
        <p className="line-clamp-2 font-sans text-[12px] leading-snug text-l-ink-lo">
          {agent.description}
        </p>
      ) : null}

      <dl className="grid grid-cols-3 gap-2">
        <Stat
          label="Versions"
          value={formatNumber(agent.versionCount)}
          sub={`${formatNumber(agent.totalRuns)} runs`}
        />
        <Stat
          label="Success"
          value={
            <span className={successTone}>
              {agent.totalRuns === 0 ? "—" : `${successPct}%`}
            </span>
          }
          sub={
            agent.totalRuns === 0
              ? "no runs yet"
              : `${formatNumber(
                  Math.round(agent.successRate * agent.totalRuns),
                )} ok`
          }
        />
        <Stat
          label="Last run"
          value={
            agent.lastRunAt ? (
              <RelativeTime iso={agent.lastRunAt} fallback="—" />
            ) : (
              "—"
            )
          }
          sub={<AgentModelLabel model={agent.model} size="xs" />}
        />
      </dl>

      <div className="mt-auto flex items-center justify-between gap-2 text-[11px] text-l-ink-dim">
        <span className="flex flex-1 items-center gap-1.5 overflow-hidden">
          {agent.lastDriftAt ? (
            <>
              <AlertTriangle
                className="size-3 shrink-0 text-event-amber"
                strokeWidth={1.75}
              />
              <span className="truncate font-mono text-event-amber/80">
                drift detected ·{" "}
                <RelativeTime iso={agent.lastDriftAt} fallback="—" />
              </span>
            </>
          ) : (
            <span className="font-mono">no drift observed</span>
          )}
        </span>
        {agent.owner ? (
          <span className="font-mono text-l-ink-dim">{agent.owner}</span>
        ) : null}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-[2px]">
      <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-l-ink-dim">
        {label}
      </dt>
      <dd className="font-sans text-[14px] font-medium leading-tight text-l-ink">
        {value}
      </dd>
      {sub ? (
        <span className="truncate font-mono text-[10px] text-l-ink-dim">
          {sub}
        </span>
      ) : null}
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
