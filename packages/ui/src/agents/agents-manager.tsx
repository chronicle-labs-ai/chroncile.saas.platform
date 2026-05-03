"use client";

import * as React from "react";

import { cx } from "../utils/cx";

import { AgentActionsMenu } from "./agent-actions-menu";
import { AgentCard } from "./agent-card";
import { AgentDetailPage } from "./agent-detail-page";
import { AgentEmpty } from "./agent-empty";
import { AgentRow } from "./agent-row";
import {
  AgentsToolbar,
  matchesHealthFilter,
  type AgentHealthFilter,
  type AgentsView,
} from "./agents-toolbar";
import { agentsManagerSeed, agentSnapshotsByName } from "./data";
import type { AgentSnapshot, AgentSummary } from "./types";

/*
 * AgentsManager — page-level surface for browsing registered agents,
 * filtering by health, switching list/grid view, and drilling into one
 * agent's detail page.
 *
 * Read-only over the registry data. The only mutation we surface is
 * "pin a version as current"; that flows through `onPinLatest` and
 * applies optimistic local state when no handler is wired (so stories
 * feel real).
 */

export interface AgentsManagerProps {
  agents?: readonly AgentSummary[];
  /** Snapshot data for the detail surface, keyed by agent name. */
  snapshotsByName?: Readonly<Record<string, AgentSnapshot>>;
  initialView?: AgentsView;
  workspace?: string;
  /** Render slot for the detail surface — defaults to a placeholder
   *  before the AgentDetailPage chassis lands. Threaded through so the
   *  same manager can host both the read-only table and the full
   *  detail view. */
  renderDetail?: (snapshot: AgentSnapshot, helpers: AgentsManagerDetailHelpers) => React.ReactNode;
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
  workspace = "Chronicle",
  renderDetail,
  onChange,
  onPinLatest,
  onOpenHashSearch,
  className,
}: AgentsManagerProps) {
  const [list, setList] = React.useState<AgentSummary[]>(() => [...initialAgents]);
  const [query, setQuery] = React.useState("");
  const [healthFilters, setHealthFilters] = React.useState<AgentHealthFilter[]>([]);
  const [view, setView] = React.useState<AgentsView>(initialView);
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
      const haystack = `${agent.name} ${agent.description ?? ""} ${
        agent.framework
      } ${agent.modelLabel} ${agent.owner ?? ""} ${agent.environment ?? ""}`;
      return haystack.toLowerCase().includes(q);
    });
  }, [list, query, healthFilters]);

  const toggleHealth = (health: AgentHealthFilter) => {
    setHealthFilters((cur) =>
      cur.includes(health) ? cur.filter((h) => h !== health) : [...cur, health],
    );
  };

  const showEmpty = list.length === 0;
  const showFilteredEmpty = !showEmpty && filtered.length === 0;

  const selectedAgent = React.useMemo(
    () => (selectedName ? list.find((a) => a.name === selectedName) ?? null : null),
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
      // Optimistic local-state mutation: bump the agent to the top.
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
          <ListHeader
            workspace={workspace}
            count={list.length}
            onOpenHashSearch={onOpenHashSearch}
          />

          {showEmpty ? (
            <AgentEmpty variant="empty" />
          ) : (
            <>
              <AgentsToolbar
                query={query}
                onQueryChange={setQuery}
                view={view}
                onViewChange={setView}
                selectedHealth={healthFilters}
                onHealthToggle={toggleHealth}
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
              ) : view === "list" ? (
                <div className="rounded-[4px] border border-hairline-strong bg-l-surface-raised">
                  {filtered.map((agent) => (
                    <AgentRow
                      key={agent.name}
                      agent={agent}
                      onOpen={(name) => setSelectedName(name)}
                      actionsSlot={
                        <AgentActionsMenu
                          agent={agent}
                          onOpen={(name) => setSelectedName(name)}
                          onPinLatest={requestPinLatest}
                          onCopyArtifactId={requestCopy}
                          onOpenHashSearch={onOpenHashSearch}
                          configHash={
                            snapshotsByName[agent.name]?.versions[0]?.artifact
                              .configHash
                          }
                          onCopyConfigHash={requestCopy}
                        />
                      }
                    />
                  ))}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {filtered.map((agent) => (
                    <AgentCard
                      key={agent.name}
                      agent={agent}
                      onOpen={(name) => setSelectedName(name)}
                      actionsSlot={
                        <AgentActionsMenu
                          agent={agent}
                          onOpen={(name) => setSelectedName(name)}
                          onPinLatest={requestPinLatest}
                          onCopyArtifactId={requestCopy}
                          onOpenHashSearch={onOpenHashSearch}
                          configHash={
                            snapshotsByName[agent.name]?.versions[0]?.artifact
                              .configHash
                          }
                          onCopyConfigHash={requestCopy}
                        />
                      }
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ── Headers ─────────────────────────────────────────────── */

interface ListHeaderProps {
  workspace: string;
  count: number;
  onOpenHashSearch?: () => void;
}

function ListHeader({ workspace, count, onOpenHashSearch: _ }: ListHeaderProps) {
  return (
    <header className="flex flex-col gap-3 border-b border-l-border-faint pb-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="mb-1 flex items-center gap-1.5 font-sans text-[11px] text-l-ink-dim">
          <span>{workspace}</span>
          <span aria-hidden>›</span>
          <span className="text-l-ink-lo">Validation</span>
          <span aria-hidden>›</span>
          <span className="text-ember">Agents</span>
        </div>
        <h1 className="font-sans text-[18px] font-medium leading-tight text-l-ink">
          Agents
        </h1>
        <p className="mt-1 max-w-2xl font-sans text-[13px] leading-5 text-l-ink-dim">
          {count === 0
            ? "Wrap an agent with the artifactory SDK to start versioning prompts, tools, models, and policies as immutable artifacts."
            : `${count} ${count === 1 ? "agent" : "agents"} · versioned across prompts, tools, models, and runtime policies.`}
        </p>
      </div>
    </header>
  );
}

interface DetailHeaderProps {
  workspace: string;
  agentName: string;
  onBack: () => void;
}

function DetailHeader({ workspace, agentName, onBack }: DetailHeaderProps) {
  return (
    <header className="flex flex-col gap-3 border-b border-l-border-faint pb-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="mb-1 flex items-center gap-1.5 font-sans text-[11px] text-l-ink-dim">
          <span>{workspace}</span>
          <span aria-hidden>›</span>
          <button
            type="button"
            onClick={onBack}
            className="text-l-ink-lo hover:text-l-ink"
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
