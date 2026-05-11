"use client";

import * as React from "react";
import { AlertTriangle, MoreHorizontal } from "lucide-react";

import { cx } from "../utils/cx";
import {
  Avatar,
  AvatarFallback,
  deriveInitials,
  type AvatarTone,
} from "../primitives/avatar";
import { Button } from "../primitives/button";

import { AgentCompanyMark } from "./agent-company-mark";
import { FRAMEWORK_META } from "./framework-meta";
import type { AgentSummary } from "./types";

/*
 * AgentLinearRow — single ~46px row tuned for the Linear-style agent
 * manager. Replaces the older `AgentRow` (8-column dense layout). The
 * row is deliberately sparse: anything that can be computed from a
 * detail surface (success rate, run count, version count, capability
 * tags, environment, modelLabel) is OFF the row.
 *
 * Grid (mirrors `DatasetLinearRow`):
 *
 *   ┌──────────────────────────────────────────────────────────┐
 *   │  AGT-001   name · [drift•]      [framework]  [av]  Apr 22  ⋯ │
 *   └──────────────────────────────────────────────────────────┘
 *
 *   1) Issue id (mono, dim) — derived from `agent.name`.
 *   2) Name + at most one tiny status pill (drift dot OR version chip).
 *   3) Framework pill (icon + label).
 *   4) Owner avatar (xs).
 *   5) Updated date (`MMM d`).
 *   6) Actions menu slot.
 */

export interface AgentLinearRowProps {
  agent: AgentSummary;
  onOpen?: (name: string) => void;
  /** Override the slot rendered in the actions column. Defaults to a
   *  read-only `MoreHorizontal` glyph button. */
  actionsSlot?: React.ReactNode;
  isActive?: boolean;
  className?: string;
}

export function AgentLinearRow({
  agent,
  onOpen,
  actionsSlot,
  isActive,
  className,
}: AgentLinearRowProps) {
  const meta = FRAMEWORK_META[agent.framework];
  const issueId = toAgentIssueId(agent.name);
  const owner = agent.owner ?? "unassigned";
  const ownerInitials = deriveInitials(owner);
  const drifting = Boolean(agent.lastDriftAt);
  const errored = agent.totalRuns > 0 && agent.successRate < 0.95;
  const idle = agent.totalRuns === 0;

  return (
    <div
      data-active={isActive || undefined}
      data-framework={agent.framework}
      className={cx(
        "group relative isolate grid h-[46px] items-center gap-2 px-3",
        "grid-cols-[76px_minmax(180px,1fr)_minmax(120px,260px)_32px_72px_28px]",
        "border-b border-l-border-faint last:border-b-0",
        "font-sans text-[13px] text-l-ink",
        className
      )}
    >
      {onOpen ? (
        <button
          type="button"
          aria-label={`Open agent ${agent.name}`}
          onClick={() => onOpen(agent.name)}
          className={cx(
            "absolute inset-0 z-0 rounded-[4px] transition-[background-color] duration-fast",
            "hover:bg-l-surface-hover",
            "focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-2px] focus-visible:outline-ember"
          )}
        />
      ) : null}

      <span className="pointer-events-none relative z-10 truncate font-mono text-[12px] tabular-nums text-l-ink-dim">
        {issueId}
      </span>

      <span className="pointer-events-none relative z-10 flex min-w-0 items-center gap-2">
        <HealthDot
          state={
            drifting
              ? "drifting"
              : errored
                ? "errored"
                : idle
                  ? "idle"
                  : "healthy"
          }
        />
        <span className="truncate font-medium text-l-ink">{agent.name}</span>
        {drifting ? (
          <span
            className="inline-flex h-5 shrink-0 items-center gap-1 rounded-pill border border-event-amber/30 bg-event-amber/10 px-1.5 font-mono text-[10.5px] tabular-nums text-event-amber"
            title="Drift observed"
          >
            <AlertTriangle className="size-3" strokeWidth={1.75} aria-hidden />
            drift
          </span>
        ) : agent.versionCount > 1 ? (
          <span className="inline-flex h-5 shrink-0 items-center rounded-pill border border-l-border-faint bg-l-wash-1 px-1.5 font-mono text-[10.5px] tabular-nums text-l-ink-dim">
            v{agent.latestVersion}
          </span>
        ) : null}
      </span>

      <span className="pointer-events-none relative z-10 flex min-w-0 justify-end">
        <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-pill border border-l-border-faint bg-l-wash-1 py-0.5 pl-0.5 pr-2 text-l-ink-lo">
          {meta ? (
            <AgentCompanyMark
              name={meta.companyName}
              domain={meta.companyDomain}
              size="xs"
              fallbackIcon={meta.Icon}
              alt={`${meta.label} logo`}
              runtimeDetect={false}
            />
          ) : null}
          <span className="truncate">{meta?.label ?? agent.framework}</span>
        </span>
      </span>

      <span className="pointer-events-none relative z-10 flex justify-end">
        <Avatar size="xs" tone={ownerTone(owner)} title={owner}>
          <AvatarFallback>{ownerInitials}</AvatarFallback>
        </Avatar>
      </span>

      <span className="pointer-events-none relative z-10 text-right font-mono text-[11.5px] tabular-nums text-l-ink-dim">
        {formatAgentDate(agent.lastRunAt)}
      </span>

      <div
        className="relative z-10 flex items-center justify-end"
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

/* ── Helpers ─────────────────────────────────────────────── */

type HealthState = "healthy" | "drifting" | "errored" | "idle";

const HEALTH_TONE: Record<HealthState, string> = {
  healthy: "bg-event-green",
  drifting: "bg-event-amber",
  errored: "bg-event-red",
  idle: "bg-l-ink-dim/60",
};

function HealthDot({ state }: { state: HealthState }) {
  return (
    <span
      aria-hidden
      className={cx("size-1.5 shrink-0 rounded-full", HEALTH_TONE[state])}
    />
  );
}

/**
 * Turn an agent name into a stable `AGT-###` label. Cheap, deterministic,
 * collision-tolerant — the id is purely visual and never persisted, so a
 * hash collision on three digits is harmless.
 */
export function toAgentIssueId(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) % 997;
  }
  return `AGT-${String(hash + 1).padStart(3, "0")}`;
}

function formatAgentDate(iso: string | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function ownerTone(owner: string): AvatarTone {
  const tones: AvatarTone[] = [
    "green",
    "teal",
    "violet",
    "amber",
    "pink",
    "ember",
  ];
  let hash = 0;
  for (let i = 0; i < owner.length; i += 1) {
    hash = (hash + owner.charCodeAt(i)) % tones.length;
  }
  return tones[hash] ?? "neutral";
}
