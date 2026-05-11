"use client";

import * as React from "react";
import { ArrowUpRight, BookOpen, Bot, PlayCircle } from "lucide-react";

import { cx } from "../utils/cx";
import { useCopy } from "../utils/use-copy";
import { Button } from "../primitives/button";
import { Tab, TabList, TabPanel, Tabs } from "../primitives/tabs";

import { AgentActionsMenu } from "./agent-actions-menu";
import { AgentCompanyMark } from "./agent-company-mark";
import { AgentConfigCanvas } from "./agent-config-canvas";
import { AgentDriftTimeline } from "./agent-drift-timeline";
import { AgentFrameworkBadge } from "./agent-framework-badge";
import { AgentRunDetailDrawer } from "./agent-run-detail-drawer";
import { AgentRunsTable } from "./agent-runs-table";
import { AgentVersionBadge } from "./agent-version-badge";
import { AgentVersionCompare } from "./agent-version-compare";
import { AgentVersionRow } from "./agent-version-row";
import { buildDriftEntries } from "./data";
import { getModelProviderMeta } from "./framework-meta";
import type {
  AgentRun,
  AgentSnapshot,
  AgentVersionSummary,
} from "./types";

/*
 * AgentDetailPage — the rewritten configuration-led detail surface.
 *
 *   Hero (purpose line · CTAs)
 *   ┌──────────────────────────────────────────────┐
 *   │ Configuration · Versions · Runs · Drift      │
 *   └──────────────────────────────────────────────┘
 *
 * Tabs went from six to four:
 *   - Configuration  (was Overview + Tools) — hybrid canvas
 *   - Versions       (was Versions + Diff)  — split-pane: list + diff
 *   - Runs           (unchanged)
 *   - Drift          (unchanged)
 *
 * Tab state is uncontrolled by default but accepts a controlled
 * `tab` prop so the dashboard's deep-link routes drive it.
 *
 * Mirrors `DatasetDetailPage` in shape: a thin header, a
 * `<Tabs>` block, and per-tab content panels rendered against the
 * snapshot.
 */

export type AgentDetailTab =
  | "configuration"
  | "versions"
  | "runs"
  | "drift";

export const AGENT_DETAIL_TABS: readonly AgentDetailTab[] = [
  "configuration",
  "versions",
  "runs",
  "drift",
];

export interface AgentDetailPageProps {
  snapshot: AgentSnapshot;
  tab?: AgentDetailTab;
  defaultTab?: AgentDetailTab;
  onTabChange?: (tab: AgentDetailTab) => void;

  /** Selected version on the Versions / Configuration / Diff anchors. */
  selectedVersion?: string;
  onSelectVersion?: (version: string) => void;

  /** Comparison anchor (the "before" side of the inline Versions diff).
   *  Defaults to the second-newest version when there are at least two. */
  diffFromVersion?: string;
  onDiffFromChange?: (version: string) => void;

  /** Selected run for the run detail drawer. */
  selectedRunId?: string | null;
  onSelectRun?: (runId: string | null) => void;

  /** Optional jump-out for the global hash search surface. */
  onOpenHashSearch?: (hint?: string) => void;

  className?: string;
}

export function AgentDetailPage({
  snapshot,
  tab: tabProp,
  defaultTab = "configuration",
  onTabChange,
  selectedVersion: selectedVersionProp,
  onSelectVersion,
  diffFromVersion: diffFromProp,
  onDiffFromChange,
  selectedRunId: selectedRunIdProp,
  onSelectRun,
  onOpenHashSearch,
  className,
}: AgentDetailPageProps) {
  const [tabState, setTabState] = React.useState<AgentDetailTab>(defaultTab);
  const tab = tabProp ?? tabState;
  const setTab = (next: AgentDetailTab) => {
    setTabState(next);
    onTabChange?.(next);
  };

  const versions = snapshot.versions;
  const fallbackSelected =
    versions.find((v) => v.status === "current")?.artifact.version ??
    versions[0]?.artifact.version ??
    "";
  const [selectedVersionState, setSelectedVersionState] =
    React.useState(fallbackSelected);
  const selectedVersion = selectedVersionProp ?? selectedVersionState;
  const setSelectedVersion = (v: string) => {
    setSelectedVersionState(v);
    onSelectVersion?.(v);
  };

  const fallbackDiffFrom =
    versions.length >= 2 ? versions[1]?.artifact.version ?? "" : "";
  const [diffFromState, setDiffFromState] = React.useState(fallbackDiffFrom);
  const diffFrom = diffFromProp ?? diffFromState;
  const setDiffFrom = (v: string) => {
    setDiffFromState(v);
    onDiffFromChange?.(v);
  };

  const [selectedRunIdState, setSelectedRunIdState] = React.useState<
    string | null
  >(null);
  const selectedRunId = selectedRunIdProp ?? selectedRunIdState;
  const setSelectedRunId = (id: string | null) => {
    setSelectedRunIdState(id);
    onSelectRun?.(id);
  };

  const selectedRun = React.useMemo<AgentRun | null>(() => {
    if (!selectedRunId) return null;
    return snapshot.runs.find((r) => r.runId === selectedRunId) ?? null;
  }, [selectedRunId, snapshot.runs]);

  const driftEntries = React.useMemo(
    () => buildDriftEntries(snapshot),
    [snapshot],
  );

  return (
    <div
      className={cx(
        "flex h-full min-h-0 flex-1 flex-col overflow-hidden",
        className,
      )}
    >
      <DetailHeader
        snapshot={snapshot}
        onOpenHashSearch={onOpenHashSearch}
      />

      <Tabs
        value={tab}
        onValueChange={(next) => setTab(next as AgentDetailTab)}
        className="flex flex-1 min-h-0 flex-col"
      >
        <TabList aria-label="Agent detail" className="px-4">
          <Tab id="configuration">Configuration</Tab>
          <Tab id="versions">
            Versions
            <span className="ml-1.5 font-mono text-[10px] tabular-nums text-l-ink-dim">
              {versions.length}
            </span>
          </Tab>
          <Tab id="runs">
            Runs
            <span className="ml-1.5 font-mono text-[10px] tabular-nums text-l-ink-dim">
              {snapshot.runs.length}
            </span>
          </Tab>
          <Tab id="drift">
            Drift
            {driftEntries.length > 0 ? (
              <span className="ml-1.5 font-mono text-[10px] tabular-nums text-event-amber">
                {driftEntries.length}
              </span>
            ) : null}
          </Tab>
        </TabList>

        <div className="flex-1 min-h-0 overflow-auto">
          <TabPanel id="configuration" className="p-4">
            <AgentConfigCanvas
              snapshot={snapshot}
              selectedVersion={selectedVersion}
              onSelectVersion={setSelectedVersion}
              selectedRunId={selectedRunId}
              onSelectRun={setSelectedRunId}
              onJumpToVersionsTab={() => setTab("versions")}
              onJumpToRunsTab={() => setTab("runs")}
              onJumpToDriftTab={() => setTab("drift")}
              onOpenHashSearch={onOpenHashSearch}
            />
          </TabPanel>

          <TabPanel id="versions" className="p-4">
            <VersionsTab
              snapshot={snapshot}
              selectedVersion={selectedVersion}
              onSelectVersion={setSelectedVersion}
              diffFrom={diffFrom}
              onDiffFromChange={setDiffFrom}
            />
          </TabPanel>

          <TabPanel id="runs" className="p-4">
            <AgentRunsTable
              runs={snapshot.runs}
              versions={versions}
              selectedRunId={selectedRunId}
              onSelectRun={setSelectedRunId}
            />
          </TabPanel>

          <TabPanel id="drift" className="p-4">
            <AgentDriftTimeline
              entries={driftEntries}
              onSelectRun={(runId) => {
                setSelectedRunId(runId);
                setTab("runs");
              }}
            />
          </TabPanel>
        </div>
      </Tabs>

      <AgentRunDetailDrawer
        isOpen={selectedRunId != null}
        onClose={() => setSelectedRunId(null)}
        run={selectedRun}
        snapshot={snapshot}
        onOpenHashSearch={onOpenHashSearch}
      />
    </div>
  );
}

/* ── Header ──────────────────────────────────────────────── */

interface DetailHeaderProps {
  snapshot: AgentSnapshot;
  onOpenHashSearch?: (hint?: string) => void;
}

function DetailHeader({ snapshot, onOpenHashSearch }: DetailHeaderProps) {
  const summary = snapshot.summary;
  const current =
    snapshot.versions.find((v) => v.status === "current") ??
    snapshot.versions[0];

  const providerMeta = getModelProviderMeta(summary.model.provider);

  /* Copy is preserved via `useCopy`, but the visible "copied!" flourish
   * (a checkmark and an aria-live label next to the actions menu) was
   * removed in the redesign. Copy still works silently — toast/feedback
   * is owned by a global pattern in a follow-up. */
  const { copy: copyArtifactId } = useCopy();
  const { copy: copyConfigHash } = useCopy();

  const purpose = summary.purpose ?? summary.description ?? "";

  return (
    <header className="flex flex-shrink-0 flex-col gap-1.5 border-b border-l-border-faint px-4 py-3">
      <div className="flex items-center gap-3">
        {providerMeta ? (
          <AgentCompanyMark
            name={providerMeta.companyName}
            domain={providerMeta.companyDomain}
            size="sm"
            alt={`${providerMeta.label} logo`}
          />
        ) : (
          <span
            className="flex size-6 shrink-0 items-center justify-center rounded-md bg-ember/10 text-ember"
            aria-hidden
          >
            <Bot className="size-3.5" strokeWidth={1.6} />
          </span>
        )}

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h2 className="truncate font-sans text-[15px] font-medium leading-tight text-l-ink">
            {summary.name}
          </h2>
          {current ? (
            <AgentVersionBadge
              version={current.artifact.version}
              status="current"
            />
          ) : null}
          {summary.lastDriftAt ? (
            <span
              aria-hidden
              className="size-1.5 shrink-0 rounded-full bg-event-amber"
              title="Drift observed"
            />
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {summary.playgroundUrl ? (
            <Button asChild variant="ghost" size="sm">
              <a
                href={summary.playgroundUrl}
                rel="noopener noreferrer"
                target="_blank"
                aria-label="Open in playground"
                title="Open in playground"
              >
                <PlayCircle
                  className="size-3.5"
                  strokeWidth={1.75}
                  aria-hidden
                />
              </a>
            </Button>
          ) : null}
          {summary.runbookUrl ? (
            <Button asChild variant="ghost" size="sm">
              <a
                href={summary.runbookUrl}
                rel="noopener noreferrer"
                target="_blank"
                aria-label="Open runbook"
                title="Open runbook"
              >
                <BookOpen
                  className="size-3.5"
                  strokeWidth={1.75}
                  aria-hidden
                />
              </a>
            </Button>
          ) : null}
          <AgentActionsMenu
            agent={summary}
            onCopyArtifactId={(value) => {
              void copyArtifactId(value);
            }}
            onCopyConfigHash={(value) => {
              void copyConfigHash(value);
            }}
            configHash={current?.artifact.configHash}
            onOpenHashSearch={(artifactId) => onOpenHashSearch?.(artifactId)}
          />
        </div>
      </div>

      {purpose ? (
        <p className="max-w-3xl truncate font-sans text-[12.5px] leading-5 text-l-ink-lo">
          {purpose}
        </p>
      ) : null}
    </header>
  );
}

/* ── Versions tab (Diff folded in) ───────────────────────── */

interface VersionsTabProps {
  snapshot: AgentSnapshot;
  selectedVersion: string;
  onSelectVersion: (version: string) => void;
  diffFrom: string;
  onDiffFromChange: (version: string) => void;
}

function VersionsTab({
  snapshot,
  selectedVersion,
  onSelectVersion,
  diffFrom,
  onDiffFromChange,
}: VersionsTabProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      <section className="flex flex-col gap-2">
        <SectionHeader
          title="All versions"
          subtitle="Each row is an immutable artifact."
        />
        <div className="rounded-[4px] border border-hairline-strong bg-l-surface-raised">
          {snapshot.versions.map((version, index) => (
            <AgentVersionRow
              key={version.artifact.artifactId}
              version={version}
              isActive={selectedVersion === version.artifact.version}
              hideCompare={index === 0}
              onOpen={onSelectVersion}
              onCompare={(against) => {
                onDiffFromChange(against);
                onSelectVersion(
                  selectedVersion ||
                    snapshot.versions[0]?.artifact.version ||
                    "",
                );
              }}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <SectionHeader
          title="Compare"
          subtitle="Pick two versions to see what changed."
        />
        <AgentVersionCompare
          versions={snapshot.versions}
          fromVersion={diffFrom}
          toVersion={selectedVersion}
          onFromChange={onDiffFromChange}
          onToChange={onSelectVersion}
        />
      </section>
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h3 className="font-sans text-[13px] font-medium text-l-ink">{title}</h3>
      {subtitle ? (
        <span className="truncate font-sans text-[11px] text-l-ink-dim">
          {subtitle}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Map a legacy `?tab=` value (overview / tools / diff) to the new tab
 * set so deep-links shared in Slack / Linear / docs continue to work.
 * Routes that read `?tab=` should pipe the value through this helper
 * before passing it to `AgentDetailPage`.
 */
export function resolveLegacyAgentDetailTab(
  raw: string | null | undefined,
): AgentDetailTab | undefined {
  if (!raw) return undefined;
  const normalized = raw.trim().toLowerCase();
  if (
    AGENT_DETAIL_TABS.includes(normalized as AgentDetailTab)
  ) {
    return normalized as AgentDetailTab;
  }
  if (normalized === "overview" || normalized === "tools") {
    return "configuration";
  }
  if (normalized === "diff") return "versions";
  return undefined;
}
