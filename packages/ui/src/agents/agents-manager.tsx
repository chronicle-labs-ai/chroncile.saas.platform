"use client";

import * as React from "react";
import { ChevronDown, Plus } from "lucide-react";

import { cx } from "../utils/cx";
import { Button } from "../primitives/button";
import { useSetSiteBreadcrumb } from "../layout/site-breadcrumb";

import { AgentActionsMenu } from "./agent-actions-menu";
import { AgentCompanyMark } from "./agent-company-mark";
import { AgentDetailPage } from "./agent-detail-page";
import { AgentEmpty } from "./agent-empty";
import { AgentLinearRow } from "./agent-linear-row";
import { AgentsFacetRail } from "./agents-facet-rail";
import { AgentsToolbar, type AgentsScope } from "./agents-toolbar";
import { agentsManagerSeed, agentSnapshotsByName } from "./data";
import { FRAMEWORK_META } from "./framework-meta";
import type {
  AgentFramework,
  AgentSnapshot,
  AgentSummary,
} from "./types";

/*
 * AgentsManager — Linear-style page-level surface for the agent
 * registry. The previous implementation stacked four loud layers
 * (display hero + KPI strip + group-by chips + dense cards/rows). The
 * rewrite mirrors `DatasetsManager`:
 *
 *   ┌──────────────────────────────────────────────────────────┐
 *   │  Agents · 18 agents · 14 active across 4 frameworks      │
 *   ├──────────────────────────────────────────────────────────┤
 *   │  [search] [filter] [panel] [hash]                        │
 *   ├──────────────────────────────────────────────────────────┤
 *   │  ▼ Vercel AI SDK · 5                                      │
 *   │     AGT-001  refund-bot   ·   [Vercel AI SDK]  [SP]  Apr 28 ⋯ │
 *   │     AGT-007  triage-bot   ·   [Vercel AI SDK]  [TS]  Apr 22 ⋯ │
 *   │  ▼ OpenAI Agents · 3                                       │
 *   └──────────────────────────────────────────────────────────┘
 *
 * Three things are deliberately gone:
 *   - `AgentsKpiStrip` (health rolls into a row dot)
 *   - Grid view + group-by chips (list-only, fixed framework grouping)
 *   - Hero subhead with display font + ember accent
 *
 * Detail navigation: when the user opens an agent inside the manager,
 * the manager renders `AgentDetailPage` inline. Read-only over the
 * registry; `onPinLatest` remains the only mutation we surface.
 */

export interface AgentsManagerProps {
  agents?: readonly AgentSummary[];
  /** Snapshot data for the detail surface, keyed by agent name. */
  snapshotsByName?: Readonly<Record<string, AgentSnapshot>>;
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
  const [scope, setScope] = React.useState<AgentsScope>("all");
  const [selectedFrameworks, setSelectedFrameworks] = React.useState<
    AgentFramework[]
  >([]);
  const [selectedOwners, setSelectedOwners] = React.useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = React.useState<string[]>(
    [],
  );
  const [panelOpen, setPanelOpen] = React.useState(true);
  const [railWidth, setRailWidth] = React.useState(320);
  const [collapsedGroups, setCollapsedGroups] = React.useState<
    readonly string[]
  >([]);
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
      if (scope === "active" && agent.totalRuns === 0) return false;
      if (scope === "idle" && agent.totalRuns > 0) return false;
      if (
        selectedFrameworks.length > 0 &&
        !selectedFrameworks.includes(agent.framework)
      ) {
        return false;
      }
      if (
        selectedOwners.length > 0 &&
        !(agent.owner && selectedOwners.includes(agent.owner))
      ) {
        return false;
      }
      if (
        selectedCategories.length > 0 &&
        !(agent.category && selectedCategories.includes(agent.category))
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
  }, [
    list,
    query,
    scope,
    selectedFrameworks,
    selectedOwners,
    selectedCategories,
  ]);

  const grouped = React.useMemo(() => groupAgents(filtered), [filtered]);
  const summary = React.useMemo(() => getAgentsSummary(list), [list]);

  const toggleFramework = (framework: AgentFramework) => {
    setSelectedFrameworks((cur) =>
      cur.includes(framework)
        ? cur.filter((f) => f !== framework)
        : [...cur, framework],
    );
  };

  const toggleOwner = (owner: string) => {
    setSelectedOwners((cur) =>
      cur.includes(owner) ? cur.filter((o) => o !== owner) : [...cur, owner],
    );
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories((cur) =>
      cur.includes(category)
        ? cur.filter((c) => c !== category)
        : [...cur, category],
    );
  };

  const toggleGroup = React.useCallback((key: string) => {
    setCollapsedGroups((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );
  }, []);

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

  /* Register the site-header breadcrumb. Detail surface deepens the
     trail with the active agent's name. */
  const breadcrumbCrumbs = React.useMemo(
    () =>
      selectedAgent
        ? [{ label: "Agents" }, { label: selectedAgent.name }]
        : [{ label: "Agents" }],
    [selectedAgent],
  );
  useSetSiteBreadcrumb(breadcrumbCrumbs);

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
        "flex h-full min-h-0 flex-col bg-l-surface text-l-ink",
        selectedSnapshot
          ? "gap-0 p-0"
          : "min-h-[calc(100svh-var(--header-height,3.5rem)-2rem)] gap-4 p-4",
        className,
      )}
    >
      {selectedSnapshot ? (
        <div className="flex flex-1 min-h-0 flex-row overflow-hidden bg-l-surface-raised">
          <div className="flex min-w-0 flex-1 flex-col">
            {renderDetail ? (
              renderDetail(selectedSnapshot, helpers)
            ) : (
              <AgentDetailPage
                snapshot={selectedSnapshot}
                onOpenHashSearch={onOpenHashSearch}
              />
            )}
          </div>
        </div>
      ) : (
        <>
          <ListHeader count={list.length} summary={summary} />

          {showEmpty ? (
            <AgentEmpty variant="empty" />
          ) : (
            <>
              <AgentsToolbar
                query={query}
                onQueryChange={setQuery}
                selectedScope={scope}
                onScopeChange={setScope}
                totalCount={list.length}
                panelOpen={panelOpen}
                onPanelToggle={() => setPanelOpen((prev) => !prev)}
                onOpenHashSearch={
                  onOpenHashSearch ? () => onOpenHashSearch() : undefined
                }
              />

              {showFilteredEmpty ? (
                <AgentEmpty
                  variant="filtered"
                  onClearFilters={() => {
                    setSelectedFrameworks([]);
                    setSelectedOwners([]);
                    setSelectedCategories([]);
                    setScope("all");
                    setQuery("");
                  }}
                />
              ) : (
                <div className="flex min-h-0 flex-1 overflow-hidden">
                  <GroupedAgentsList
                    groups={grouped}
                    collapsedGroups={collapsedGroups}
                    onToggleGroup={toggleGroup}
                    onOpen={(name) => setSelectedName(name)}
                    snapshotsByName={snapshotsByName}
                    onPinLatest={requestPinLatest}
                    onCopy={requestCopy}
                    onOpenHashSearch={onOpenHashSearch}
                  />
                  {panelOpen ? (
                    <AgentsFacetRail
                      agents={list}
                      selectedFrameworks={selectedFrameworks}
                      onFrameworkToggle={toggleFramework}
                      selectedOwners={selectedOwners}
                      onOwnerToggle={toggleOwner}
                      selectedCategories={selectedCategories}
                      onCategoryToggle={toggleCategory}
                      width={railWidth}
                      onWidthChange={setRailWidth}
                    />
                  ) : null}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ── Header ──────────────────────────────────────────────── */

interface AgentsSummary {
  total: number;
  active: number;
  frameworks: number;
}

function getAgentsSummary(agents: readonly AgentSummary[]): AgentsSummary {
  const frameworks = new Set<AgentFramework>();
  let active = 0;
  for (const agent of agents) {
    frameworks.add(agent.framework);
    if (agent.totalRuns > 0) active += 1;
  }
  return { total: agents.length, active, frameworks: frameworks.size };
}

interface ListHeaderProps {
  count: number;
  summary: AgentsSummary;
}

/**
 * Hero header — mirrors `DatasetsManager`'s `ListHeader` so both
 * surfaces read as the same product. Display headline at 34/44px with
 * an italic ember-toned accent ("fleet."), followed by a 12.5px dim
 * summary line. The KPI strip is intentionally absent — health rolls
 * into the per-row dot and the facet rail handles filtering.
 */
function ListHeader({ count, summary }: ListHeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-l-border-faint pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 className="font-display text-[34px] font-normal leading-none tracking-[-0.04em] text-l-ink-hi md:text-[44px]">
          Your agent{" "}
          <em className="font-normal italic text-ember">fleet.</em>
        </h1>
        <p className="mt-2 max-w-2xl text-[12.5px] leading-5 text-l-ink-dim">
          What every agent is for, what it&rsquo;s been doing, and where
          it&rsquo;s drifting.{" "}
          {count > 0
            ? `${summary.total} ${summary.total === 1 ? "agent" : "agents"} · ${summary.active} active across ${summary.frameworks} ${summary.frameworks === 1 ? "framework" : "frameworks"}.`
            : "Wrap an agent with the artifactory SDK to start versioning prompts, tools, models, and policies as immutable artifacts."}
        </p>
      </div>
    </header>
  );
}

/* ── Grouping ────────────────────────────────────────────── */

interface AgentGroup {
  key: AgentFramework;
  label: string;
  agents: readonly AgentSummary[];
}

function groupAgents(
  agents: readonly AgentSummary[],
): readonly AgentGroup[] {
  const groups = new Map<AgentFramework, AgentSummary[]>();
  for (const agent of agents) {
    const arr = groups.get(agent.framework);
    if (arr) arr.push(agent);
    else groups.set(agent.framework, [agent]);
  }
  return Array.from(groups.entries())
    .map(([key, arr]) => ({
      key,
      label: FRAMEWORK_META[key]?.label ?? key,
      agents: arr,
    }))
    .sort((a, b) => {
      if (b.agents.length !== a.agents.length) {
        return b.agents.length - a.agents.length;
      }
      return a.label.localeCompare(b.label);
    });
}

/* ── Grouped list ────────────────────────────────────────── */

interface GroupedAgentsListProps {
  groups: readonly AgentGroup[];
  collapsedGroups: readonly string[];
  onToggleGroup: (key: string) => void;
  onOpen: (name: string) => void;
  snapshotsByName: Readonly<Record<string, AgentSnapshot>>;
  onPinLatest: (name: string) => Promise<void> | void;
  onCopy: (value: string) => void;
  onOpenHashSearch?: (hint?: string) => void;
}

function GroupedAgentsList({
  groups,
  collapsedGroups,
  onToggleGroup,
  onOpen,
  snapshotsByName,
  onPinLatest,
  onCopy,
  onOpenHashSearch,
}: GroupedAgentsListProps) {
  const collapsed = React.useMemo(
    () => new Set(collapsedGroups),
    [collapsedGroups],
  );

  return (
    <div className="flex min-w-0 flex-1 overflow-hidden">
      <div className="chron-scrollbar-hidden flex h-full w-full flex-col gap-2 overflow-auto">
        {groups.map((group) => {
          const isCollapsed = collapsed.has(group.key);
          const meta = FRAMEWORK_META[group.key];
          return (
            <section key={group.key} className="flex flex-col">
              <div className="flex h-9 items-center gap-2 rounded-md border border-transparent bg-l-wash-1 px-3 text-[13px] text-l-ink">
                <button
                  type="button"
                  aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${group.label}`}
                  aria-expanded={!isCollapsed}
                  onClick={() => onToggleGroup(group.key)}
                  className="flex size-5 items-center justify-center rounded-md text-l-ink-dim transition-[background-color,color] duration-fast hover:bg-l-wash-3 hover:text-l-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember/40"
                >
                  <ChevronDown
                    className={cx(
                      "size-3.5 transition-transform duration-fast",
                      isCollapsed ? "-rotate-90" : null,
                    )}
                    strokeWidth={1.75}
                  />
                </button>
                {meta ? (
                  <AgentCompanyMark
                    name={meta.companyName}
                    domain={meta.companyDomain}
                    size="xs"
                    fallbackIcon={meta.Icon}
                    alt={`${meta.label} logo`}
                  />
                ) : null}
                <span className="font-medium">{group.label}</span>
                <span className="font-mono text-[11px] tabular-nums text-l-ink-dim">
                  {group.agents.length}
                </span>
                <Button
                  variant="icon"
                  size="sm"
                  aria-label={`Add agent to ${group.label}`}
                  className="ml-auto"
                  isDisabled
                >
                  <Plus className="size-3.5" strokeWidth={1.75} />
                </Button>
              </div>

              {isCollapsed ? null : (
                <div className="flex flex-col">
                  {group.agents.map((agent) => (
                    <AgentLinearRow
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
          );
        })}
      </div>
    </div>
  );
}
