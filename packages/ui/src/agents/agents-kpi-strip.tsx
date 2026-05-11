"use client";

import * as React from "react";
import { AlertTriangle, Check, MoonStar, X } from "lucide-react";

import { cx } from "../utils/cx";

import type { AgentHealthFilter } from "./agents-toolbar";
import type { AgentSummary } from "./types";

/*
 * AgentsKpiStrip — four-tile band rendered between the hero and the
 * grouped grid. Each tile reports a roll-up over the visible agents
 * and doubles as a click-to-filter affordance:
 *
 *   [ Healthy 14 ] [ Drifting 2 ] [ Errors 1 ] [ Idle 0 ]
 *
 * "Healthy" / "Drifting" / "Errors" map to the existing
 * `AgentHealthFilter` keys; "Idle" surfaces agents with no runs yet
 * (visual only — the filter is implicit). The active filter shows the
 * ember selection ring; toggling clears it.
 */

export type AgentsKpiKey = AgentHealthFilter | "idle";

export const AGENTS_KPI_KEYS: readonly AgentsKpiKey[] = [
  "healthy",
  "drifting",
  "errored",
  "idle",
];

export interface AgentsKpiStripProps {
  agents: readonly AgentSummary[];
  selected: readonly AgentHealthFilter[];
  onToggle: (filter: AgentHealthFilter) => void;
  className?: string;
}

export function AgentsKpiStrip({
  agents,
  selected,
  onToggle,
  className,
}: AgentsKpiStripProps) {
  const counts = React.useMemo(() => countsFor(agents), [agents]);
  const selectedSet = new Set(selected);

  return (
    <section
      aria-label="Agent fleet health"
      className={cx(
        "grid grid-cols-2 gap-2 sm:grid-cols-4",
        className,
      )}
    >
      <KpiTile
        kpi="healthy"
        count={counts.healthy}
        active={selectedSet.has("healthy")}
        onSelect={() => onToggle("healthy")}
      />
      <KpiTile
        kpi="drifting"
        count={counts.drifting}
        active={selectedSet.has("drifting")}
        onSelect={() => onToggle("drifting")}
      />
      <KpiTile
        kpi="errored"
        count={counts.errored}
        active={selectedSet.has("errored")}
        onSelect={() => onToggle("errored")}
      />
      <KpiTile kpi="idle" count={counts.idle} />
    </section>
  );
}

interface KpiTileProps {
  kpi: AgentsKpiKey;
  count: number;
  active?: boolean;
  onSelect?: () => void;
}

const KPI_META: Record<
  AgentsKpiKey,
  {
    label: string;
    sub: string;
    Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    tone: string;
    dot: string;
  }
> = {
  healthy: {
    label: "Healthy",
    sub: "≥ 95% successful",
    Icon: Check,
    tone: "text-event-green",
    dot: "bg-event-green",
  },
  drifting: {
    label: "Drifting",
    sub: "model shifted",
    Icon: AlertTriangle,
    tone: "text-event-amber",
    dot: "bg-event-amber",
  },
  errored: {
    label: "Errors",
    sub: "< 95% successful",
    Icon: X,
    tone: "text-event-red",
    dot: "bg-event-red",
  },
  idle: {
    label: "Idle",
    sub: "no runs yet",
    Icon: MoonStar,
    tone: "text-l-ink-dim",
    dot: "bg-l-ink-dim",
  },
};

function KpiTile({ kpi, count, active, onSelect }: KpiTileProps) {
  const meta = KPI_META[kpi];
  const interactive = typeof onSelect === "function";

  const content = (
    <>
      <span
        aria-hidden
        className={cx(
          "flex size-6 shrink-0 items-center justify-center rounded-[3px] bg-l-wash-2",
          meta.tone,
        )}
      >
        <meta.Icon className="size-3.5" strokeWidth={1.75} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-[1px]">
        <span className="flex items-baseline gap-1.5">
          <span
            className={cx(
              "font-sans text-[18px] font-medium leading-none tabular-nums",
              count === 0 ? "text-l-ink-dim" : "text-l-ink",
            )}
          >
            {count}
          </span>
          <span className="font-sans text-[12px] font-medium text-l-ink-lo">
            {meta.label}
          </span>
        </span>
        <span className="truncate font-mono text-[10px] tabular-nums text-l-ink-dim">
          {meta.sub}
        </span>
      </div>
    </>
  );

  if (!interactive) {
    return (
      <div
        data-active={active || undefined}
        className={cx(
          "flex items-center gap-2.5 rounded-[4px] border border-hairline-strong bg-l-surface-raised px-3 py-2.5",
        )}
      >
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      data-active={active || undefined}
      aria-pressed={active}
      className={cx(
        "group flex items-center gap-2.5 rounded-[4px] border border-hairline-strong bg-l-surface-raised px-3 py-2.5 text-left",
        "transition-colors duration-fast",
        "hover:border-l-border-strong hover:bg-l-surface-hover",
        "focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-2px] focus-visible:outline-ember",
        "data-[active=true]:border-ember/45 data-[active=true]:bg-l-surface-selected",
      )}
    >
      {content}
    </button>
  );
}

function countsFor(agents: readonly AgentSummary[]): Record<AgentsKpiKey, number> {
  const out: Record<AgentsKpiKey, number> = {
    healthy: 0,
    drifting: 0,
    errored: 0,
    idle: 0,
  };
  for (const a of agents) {
    if (a.totalRuns === 0) {
      out.idle += 1;
    } else if (a.successRate >= 0.95) {
      out.healthy += 1;
    } else {
      out.errored += 1;
    }
    if (a.lastDriftAt) out.drifting += 1;
  }
  return out;
}
