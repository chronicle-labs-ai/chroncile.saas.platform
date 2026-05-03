"use client";

import * as React from "react";
import { Hash } from "lucide-react";

import { cx } from "../utils/cx";
import { Button } from "../primitives/button";

import { AgentActionsMenu } from "./agent-actions-menu";
import { AgentCard } from "./agent-card";
import { AgentDetailPage } from "./agent-detail-page";
import { AgentEmpty } from "./agent-empty";
import { AgentRow } from "./agent-row";
import { AgentsKpiStrip } from "./agents-kpi-strip";
import {
  AgentsToolbar,
  matchesHealthFilter,
  type AgentHealthFilter,
  type AgentsGroupBy,
  type AgentsView,
} from "./agents-toolbar";
import { agentsManagerSeed, agentSnapshotsByName } from "./data";
import { FRAMEWORK_META } from "./framework-meta";
import type { AgentSnapshot, AgentSummary } from "./types";

/*
 * AgentsManager — page-level surface for browsing registered agents.
 *
 * The rewrite swaps the old Linear-utility header for a brand-aligned
 * narrative shell ("Your agent fleet.") and reorganizes the surface
 * around three jobs:
 *
 *   1. Tell the user what agents are for     → AgentCard purpose line
 *   2. Tell the user how the fleet is doing  → AgentsKpiStrip tiles
 *   3. Group by what makes sense to the user → AgentsToolbar groupBy
 *
 * Detail navigation: when the user opens an agent inside the manager,
 * the manager renders `AgentDetailPage` inline. Read-only over the
 * registry; the only mutation we surface is "pin a version as current"
 * which flows through `onPinLatest` (optimistic when no handler is
 * wired so stories feel real).
 */

export interface AgentsManagerProps {
  agents?: readonly AgentSummary[];
  /** Snapshot data for the detail surface, keyed by agent name. */
  snapshotsByName?: Readonly<Record<string, AgentSnapshot>>;
  initialView?: AgentsView;
  initialGroupBy?: AgentsGroupBy;
  workspace?: string;
  /** Render slot for the detail surface — defaults to the
   *  `AgentDetailPage` chassis. Threaded through so the same manager
   *  can host both the read-only table and the full detail view. */
  renderDetail?: (
    snapshot: AgentSnapshot,
    helpers: AgentsManagerDetailHelpers,
  ) => React.ReactNode;
  /** Notification when the agents list changes (from pinning). */
  onChange?: (next: readonly AgentSummary[]) => void;
  /** Pin the latest published version as current. When no handler is
   *  supplied, the manager applies the change to local state. */
  onPinLatest?: (name: string) => Promise<void> | void;
  /** Optional jump-out for the global hash search surface. The hint
   *  (artifactId, hash) is forwarded so the destination can pre-fill
   *  the search box. */
  onOpenHashSearch?: (hint?: string) => void;
  className?: string;
}

export interface AgentsManagerDetailHelpers {
  goBack: () => void;
  openHashSearch: (artifactId: string) => void;
}

export function AgentsManager({
  agents: initialAgents = agentsManagerSeed,
  snapshotsByName = agentSnapshotsByName,
  initialView = "grid",
  initialGroupBy = "purpose",
  workspace = "Chronicle",
  renderDetail,
  onChange,
  onPinLatest,
  onOpenHashSearch,
  className,
}: AgentsManagerProps) {
  const [list, setList] = React.useState<AgentSummary[]>(() => [
    ...initialAgents,
  ]);
  const [query, setQuery] = React.useState("");
  const [healthFilters, setHealthFilters] = React.useState<AgentHealthFilter[]>(
    [],
  );
  const [view, setView] = React.useState<AgentsView>(initialView);
  const [groupBy, setGroupBy] =
    React.useState<AgentsGroupBy>(initialGroupBy);
  const [selectedName, setSelectedName] = React.useState<string | null>(null);

  const propagate = React.useCallback(
    (next: AgentSummary[]) => {
      setList(next);
      onChange?.(next);
    },
    [onChange],
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((agent) => {
      if (
        healthFilters.length > 0 &&
        !healthFilters.some((f) => matchesHealthFilter(agent, f))
      ) {
        return false;
      }
      if (!q) return true;
      const haystack = [
        agent.name,
        agent.description ?? "",
        agent.purpose ?? "",
        agent.personaSummary ?? "",
        (agent.capabilityTags ?? []).join(" "),
        agent.framework,
        agent.modelLabel,
        agent.owner ?? "",
        agent.environment ?? "",
        agent.category ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [list, query, healthFilters]);

  const grouped = React.useMemo(
    () => groupAgents(filtered, groupBy),
    [filtered, groupBy],
  );

  const toggleHealth = (health: AgentHealthFilter) => {
    setHealthFilters((cur) =>
      cur.includes(health)
        ? cur.filter((h) => h !== health)
        : [...cur, health],
    );
  };

  const showEmpty = list.length === 0;
  const showFilteredEmpty = !showEmpty && filtered.length === 0;

  const selectedAgent = React.useMemo(
    () =>
      selectedName
        ? list.find((a) => a.name === selectedName) ?? null
        : null,
    [selectedName, list],
  );

  const selectedSnapshot = React.useMemo<AgentSnapshot | null>(() => {
    if (!selectedAgent) return null;
    const fromIndex = snapshotsByName[selectedAgent.name];
    if (fromIndex) return { ...fromIndex, summary: selectedAgent };
    return null;
  }, [selectedAgent, snapshotsByName]);

  const requestCopy = React.useCallback((value: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(value).catch(() => undefined);
    }
  }, []);

  const requestPinLatest = React.useCallback(
    async (name: string) => {
      const target = list.find((a) => a.name === name);
      if (!target) return;
      if (onPinLatest) {
        await onPinLatest(name);
      }
      const reordered = [target, ...list.filter((a) => a.name !== name)];
      propagate(reordered);
    },
    [list, onPinLatest, propagate],
  );

  const helpers: AgentsManagerDetailHelpers = React.useMemo(
    () => ({
      goBack: () => setSelectedName(null),
      openHashSearch: (artifactId: string) => {
        onOpenHashSearch?.(artifactId);
        requestCopy(artifactId);
      },
    }),
    [onOpenHashSearch, requestCopy],
  );

  return (
    <div
      className={cx(
        "flex min-h-[calc(100svh-var(--header-height,3.5rem)-2rem)] flex-col gap-4 bg-l-surface p-4 text-l-ink",
        className,
      )}
    >
      {selectedSnapshot ? (
        <>
          <DetailHeader
            workspace={workspace}
            agentName={selectedSnapshot.summary.name}
            onBack={() => setSelectedName(null)}
          />
          <div className="flex flex-1 min-h-0 flex-col rounded-[4px] border border-hairline-strong bg-l-surface-raised">
            {renderDetail ? (
              renderDetail(selectedSnapshot, helpers)
            ) : (
              <AgentDetailPage
                snapshot={selectedSnapshot}
                onOpenHashSearch={onOpenHashSearch}
              />
            )}
          </div>
        </>
      ) : (
        <>
          <ManagerHero
            workspace={workspace}
            count={list.length}
            onOpenHashSearch={onOpenHashSearch}
          />

          {showEmpty ? (
            <AgentEmpty variant="empty" />
          ) : (
            <>
              <AgentsKpiStrip
                agents={list}
                selected={healthFilters}
                onToggle={toggleHealth}
              />

              <AgentsToolbar
                query={query}
                onQueryChange={setQuery}
                view={view}
                onViewChange={setView}
                groupBy={groupBy}
                onGroupByChange={setGroupBy}
                totalCount={list.length}
                onOpenHashSearch={onOpenHashSearch}
              />

              {showFilteredEmpty ? (
                <AgentEmpty
                  variant="filtered"
                  onClearFilters={() => {
                    setHealthFilters([]);
                    setQuery("");
                  }}
                />
              ) : (
                <GroupedFleet
                  groups={grouped}
                  view={view}
                  groupBy={groupBy}
                  snapshotsByName={snapshotsByName}
                  onOpen={(name) => setSelectedName(name)}
                  onPinLatest={requestPinLatest}
                  onCopy={requestCopy}
                  onOpenHashSearch={onOpenHashSearch}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ── Hero ────────────────────────────────────────────────── */

interface ManagerHeroProps {
  workspace: string;
  count: number;
  onOpenHashSearch?: () => void;
}

function ManagerHero({
  workspace,
  count,
  onOpenHashSearch,
}: ManagerHeroProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-l-border-faint pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="mb-3 flex items-center gap-2 font-mono text-[8.5px] uppercase tracking-[0.2em] text-l-ink-dim">
          <span>{workspace}</span>
          <span aria-hidden>/</span>
          <span className="text-ember">Agents</span>
        </div>
        <h1 className="font-display text-[34px] font-normal leading-none tracking-[-0.04em] text-l-ink-hi md:text-[44px]">
          Your agent{" "}
          <em className="font-normal italic text-l-ink-lo">fleet.</em>
        </h1>
        <p className="mt-2 max-w-2xl text-[12.5px] leading-5 text-l-ink-dim">
          What every agent is for, what it&rsquo;s been doing, and where it&rsquo;s
          drifting. {count > 0
            ? `${count} ${count === 1 ? "agent" : "agents"} versioned across prompts, tools, models, and runtime policies.`
            : "Wrap an agent with the artifactory SDK to start versioning prompts, tools, models, and policies as immutable artifacts."}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-l-ink-dim">
          Live
        </span>
        {onOpenHashSearch ? (
          <Button
            variant="secondary"
            size="sm"
            onPress={onOpenHashSearch}
            leadingIcon={<Hash className="size-3.5" strokeWidth={1.75} />}
          >
            Hash search
          </Button>
        ) : null}
      </div>
    </header>
  );
}

interface DetailHeaderProps {
  workspace: string;
  agentName: string;
  onBack: () => void;
}

function DetailHeader({
  workspace,
  agentName,
  onBack,
}: DetailHeaderProps) {
  return (
    <header className="flex flex-col gap-3 border-b border-l-border-faint pb-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="mb-1 flex items-center gap-1.5 font-sans text-[11px] text-l-ink-dim">
          <span>{workspace}</span>
          <span aria-hidden>›</span>
          <button
            type="button"
            onClick={onBack}
            className={cx(
              "text-l-ink-lo transition-colors duration-fast",
              "hover:text-l-ink",
              "focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-ember",
            )}
          >
            Agents
          </button>
          <span aria-hidden>›</span>
          <span className="truncate text-ember">{agentName}</span>
        </div>
      </div>
    </header>
  );
}

/* ── Grouping ────────────────────────────────────────────── */

interface AgentGroup {
  key: string;
  label: string;
  description?: string;
  agents: readonly AgentSummary[];
}

function groupAgents(
  agents: readonly AgentSummary[],
  groupBy: AgentsGroupBy,
): readonly AgentGroup[] {
  if (groupBy === "flat") {
    return [
      {
        key: "all",
        label: "All agents",
        agents,
      },
    ];
  }

  const groups = new Map<string, AgentSummary[]>();

  for (const agent of agents) {
    const key =
      groupBy === "framework"
        ? agent.framework
        : agent.category ?? "uncategorized";
    const arr = groups.get(key);
    if (arr) arr.push(agent);
    else groups.set(key, [agent]);
  }

  const ordered = Array.from(groups.entries()).map(([key, arr]) => ({
    key,
    label:
      groupBy === "framework"
        ? FRAMEWORK_META[key as keyof typeof FRAMEWORK_META]?.label ?? key
        : key === "uncategorized"
          ? "Uncategorized"
          : key,
    agents: arr,
  }));

  ordered.sort((a, b) => {
    if (b.agents.length !== a.agents.length) {
      return b.agents.length - a.agents.length;
    }
    return a.label.localeCompare(b.label);
  });

  return ordered;
}

/* ── Grouped fleet ──────────────────────────────────────── */

interface GroupedFleetProps {
  groups: readonly AgentGroup[];
  view: AgentsView;
  groupBy: AgentsGroupBy;
  snapshotsByName: Readonly<Record<string, AgentSnapshot>>;
  onOpen: (name: string) => void;
  onPinLatest: (name: string) => Promise<void> | void;
  onCopy: (value: string) => void;
  onOpenHashSearch?: (hint?: string) => void;
}

function GroupedFleet({
  groups,
  view,
  groupBy,
  snapshotsByName,
  onOpen,
  onPinLatest,
  onCopy,
  onOpenHashSearch,
}: GroupedFleetProps) {
  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => (
        <section key={group.key} className="flex flex-col gap-2.5">
          {groupBy === "flat" ? null : (
            <header className="flex items-baseline justify-between gap-3 border-b border-l-border-faint pb-1.5">
              <h2 className="font-sans text-[12px] font-medium tracking-[0.02em] text-l-ink">
                {group.label}
              </h2>
              <span className="font-mono text-[10.5px] tabular-nums text-l-ink-dim">
                {group.agents.length} agent
                {group.agents.length === 1 ? "" : "s"}
              </span>
            </header>
          )}

          {view === "list" ? (
            <div className="rounded-[4px] border border-hairline-strong bg-l-surface-raised">
              {group.agents.map((agent) => (
                <AgentRow
                  key={agent.name}
                  agent={agent}
                  onOpen={onOpen}
                  actionsSlot={
                    <AgentActionsMenu
                      agent={agent}
                      onOpen={onOpen}
                      onPinLatest={onPinLatest}
                      onCopyArtifactId={onCopy}
                      onOpenHashSearch={onOpenHashSearch}
                      configHash={
                        snapshotsByName[agent.name]?.versions[0]?.artifact
                          .configHash
                      }
                      onCopyConfigHash={onCopy}
                    />
                  }
                />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {group.agents.map((agent) => (
                <AgentCard
                  key={agent.name}
                  agent={agent}
                  onOpen={onOpen}
                  actionsSlot={
                    <AgentActionsMenu
                      agent={agent}
                      onOpen={onOpen}
                      onPinLatest={onPinLatest}
                      onCopyArtifactId={onCopy}
                      onOpenHashSearch={onOpenHashSearch}
                      configHash={
                        snapshotsByName[agent.name]?.versions[0]?.artifact
                          .configHash
                      }
                      onCopyConfigHash={onCopy}
                    />
                  }
                />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
