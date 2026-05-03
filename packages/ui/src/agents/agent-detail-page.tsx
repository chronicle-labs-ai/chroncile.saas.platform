"use client";

import * as React from "react";

import { cx } from "../utils/cx";
import { useCopy } from "../utils/use-copy";
import { Tab, TabList, TabPanel, Tabs } from "../primitives/tabs";

import { AgentActionsMenu } from "./agent-actions-menu";
import { AgentCompanyMark } from "./agent-company-mark";
import { AgentDriftTimeline } from "./agent-drift-timeline";
import { AgentFrameworkBadge } from "./agent-framework-badge";
import { AgentMetricsStrip } from "./agent-metrics-strip";
import { AgentModelLabel } from "./agent-model-label";
import { AgentRunDetailDrawer } from "./agent-run-detail-drawer";
import { AgentRunsTable } from "./agent-runs-table";
import { AgentToolsPanel } from "./agent-tools-panel";
import { AgentVersionBadge } from "./agent-version-badge";
import { AgentVersionCompare } from "./agent-version-compare";
import { AgentVersionRow } from "./agent-version-row";
import { AgentVersionTimeline } from "./agent-version-timeline";
import { buildDriftEntries } from "./data";
import { Bot } from "lucide-react";
import { getModelProviderMeta } from "./framework-meta";
import type {
  AgentRun,
  AgentSnapshot,
  AgentVersionSummary,
} from "./types";

/*
 * AgentDetailPage — full agent detail surface. Tabs:
 *
 *   Overview · Versions · Diff · Runs · Tools · Drift
 *
 * Tab state is uncontrolled by default but accepts a controlled
 * `tab` prop so the dashboard's deep-link routes
 * (`/dashboard/agents/[name]/versions/[version]`, …) can drive it.
 *
 * Mirrors `DatasetDetailPage` in shape: a thin header, a
 * `<Tabs>` block, and per-tab content panels that
 * render against the snapshot.
 */

export type AgentDetailTab =
  | "overview"
  | "versions"
  | "diff"
  | "runs"
  | "tools"
  | "drift";

export const AGENT_DETAIL_TABS: readonly AgentDetailTab[] = [
  "overview",
  "versions",
  "diff",
  "runs",
  "tools",
  "drift",
];

export interface AgentDetailPageProps {
  snapshot: AgentSnapshot;
  tab?: AgentDetailTab;
  defaultTab?: AgentDetailTab;
  onTabChange?: (tab: AgentDetailTab) => void;

  /** Selected version on the Versions / Tools / Drift / Diff tabs. */
  selectedVersion?: string;
  onSelectVersion?: (version: string) => void;

  /** Comparison anchor (the "before" side of the Diff tab). Defaults
   *  to the second-newest version when there are at least two. */
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
  defaultTab = "overview",
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
  const [selectedVersionState, setSelectedVersionState] = React.useState(
    fallbackSelected,
  );
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

  const selectedVersionSummary = React.useMemo<AgentVersionSummary | null>(
    () => versions.find((v) => v.artifact.version === selectedVersion) ?? null,
    [versions, selectedVersion],
  );

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
        onJumpToCompare={() => {
          if (versions.length >= 2) {
            setTab("diff");
          }
        }}
      />

      <Tabs
        value={tab}
        onValueChange={(next) => setTab(next as AgentDetailTab)}
        className="flex flex-1 min-h-0 flex-col"
      >
        <TabList aria-label="Agent detail" className="px-4">
          <Tab id="overview">Overview</Tab>
          <Tab id="versions">
            Versions
            <span className="ml-1.5 font-sans text-[11px] text-l-ink-dim">
              {versions.length}
            </span>
          </Tab>
          <Tab id="diff">Diff</Tab>
          <Tab id="runs">
            Runs
            <span className="ml-1.5 font-sans text-[11px] text-l-ink-dim">
              {snapshot.runs.length}
            </span>
          </Tab>
          <Tab id="tools">Tools</Tab>
          <Tab id="drift">
            Drift
            {driftEntries.length > 0 ? (
              <span className="ml-1.5 font-sans text-[11px] text-event-amber">
                {driftEntries.length}
              </span>
            ) : null}
          </Tab>
        </TabList>

        <div className="flex-1 min-h-0 overflow-auto">
          <TabPanel id="overview" className="p-4">
            <OverviewTab
              snapshot={snapshot}
              selectedVersion={selectedVersion}
              onSelectVersion={setSelectedVersion}
              onJumpToVersionsTab={() => setTab("versions")}
              onJumpToRunsTab={() => setTab("runs")}
            />
          </TabPanel>

          <TabPanel id="versions" className="p-4">
            <VersionsTab
              snapshot={snapshot}
              selectedVersion={selectedVersion}
              onSelectVersion={setSelectedVersion}
              onCompareAgainst={(version) => {
                setDiffFrom(version);
                setTab("diff");
              }}
            />
          </TabPanel>

          <TabPanel id="diff" className="p-4">
            <AgentVersionCompare
              versions={versions}
              fromVersion={diffFrom}
              toVersion={selectedVersion}
              onFromChange={setDiffFrom}
              onToChange={setSelectedVersion}
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

          <TabPanel id="tools" className="p-4">
            <AgentToolsPanel
              version={
                selectedVersionSummary ?? versions[0] ?? null
              }
              versions={versions}
              onSelectVersion={setSelectedVersion}
              selectedVersion={selectedVersion}
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
  onJumpToCompare: () => void;
}

function DetailHeader({
  snapshot,
  onOpenHashSearch,
  onJumpToCompare: _onJumpToCompare,
}: DetailHeaderProps) {
  const summary = snapshot.summary;
  const current =
    snapshot.versions.find((v) => v.status === "current") ??
    snapshot.versions[0];

  const providerMeta = getModelProviderMeta(summary.model.provider);

  // Two independent copy sessions so the feedback label can name what
  // was actually copied. Both share the same 1.1s reset window so the
  // affordance feels consistent.
  const { copy: copyArtifactId, copied: copiedArtifactId } = useCopy();
  const { copy: copyConfigHash, copied: copiedConfigHash } = useCopy();
  const feedbackLabel = copiedArtifactId
    ? "Artifact ID copied"
    : copiedConfigHash
      ? "Config hash copied"
      : "";

  return (
    <header className="flex flex-shrink-0 items-start gap-3 border-b border-l-border-faint px-4 py-3">
      {providerMeta ? (
        <AgentCompanyMark
          name={providerMeta.companyName}
          domain={providerMeta.companyDomain}
          size="md"
          alt={`${providerMeta.label} logo`}
        />
      ) : (
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-[3px] bg-ember/10 text-ember"
          aria-hidden
        >
          <Bot className="size-4.5" strokeWidth={1.6} />
        </span>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <h2 className="truncate font-sans text-[16px] font-medium leading-tight text-l-ink">
            {summary.name}
          </h2>
          {current ? (
            <AgentVersionBadge
              version={current.artifact.version}
              status="current"
            />
          ) : null}
          <AgentFrameworkBadge framework={summary.framework} />
        </div>
        {summary.description ? (
          <p className="max-w-2xl text-[12.5px] leading-5 text-l-ink-dim">
            {summary.description}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 font-sans text-[11px] text-l-ink-dim">
          {summary.owner ? <span>Owner · {summary.owner}</span> : null}
          {summary.environment ? (
            <>
              <span aria-hidden>·</span>
              <span>Env · {summary.environment}</span>
            </>
          ) : null}
          <span aria-hidden>·</span>
          <AgentModelLabel model={summary.model} size="xs" />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span
          role="status"
          aria-live="polite"
          className={cx(
            "inline-flex items-center gap-1 font-sans text-[11px] text-event-green transition-opacity duration-fast",
            feedbackLabel ? "opacity-100" : "opacity-0",
          )}
        >
          {feedbackLabel ? (
            <>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="size-3"
                aria-hidden
              >
                <path
                  d="M4.5 12.75l6 6 9-13.5"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {feedbackLabel}
            </>
          ) : null}
        </span>
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
    </header>
  );
}

/* ── Overview tab ────────────────────────────────────────── */

interface OverviewTabProps {
  snapshot: AgentSnapshot;
  selectedVersion: string;
  onSelectVersion: (version: string) => void;
  onJumpToVersionsTab: () => void;
  onJumpToRunsTab: () => void;
}

function OverviewTab({
  snapshot,
  selectedVersion,
  onSelectVersion,
  onJumpToVersionsTab: _onJumpToVersionsTab,
  onJumpToRunsTab: _onJumpToRunsTab,
}: OverviewTabProps) {
  const recentRuns = snapshot.runs.slice(0, 6);

  return (
    <div className="flex flex-col gap-4">
      <AgentMetricsStrip snapshot={snapshot} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_minmax(0,360px)]">
        <section className="flex flex-col gap-2">
          <SectionHeader
            title="Recent runs"
            subtitle={`${snapshot.runs.length} total`}
          />
          {recentRuns.length === 0 ? (
            <div className="rounded-[4px] border border-l-border-faint bg-l-wash-1 px-3 py-6 text-center font-sans text-[12px] text-l-ink-dim">
              No runs recorded yet.
            </div>
          ) : (
            <div className="rounded-[4px] border border-hairline-strong bg-l-surface-raised">
              <AgentRunsTable
                runs={recentRuns}
                versions={snapshot.versions}
                selectedRunId={null}
                onSelectRun={() => undefined}
                hideHeader
              />
            </div>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <SectionHeader
            title="Version history"
            subtitle={`${snapshot.versions.length} published`}
          />
          <AgentVersionTimeline
            versions={snapshot.versions}
            selectedVersion={selectedVersion}
            onSelectVersion={onSelectVersion}
          />
        </section>
      </div>
    </div>
  );
}

/* ── Versions tab ────────────────────────────────────────── */

interface VersionsTabProps {
  snapshot: AgentSnapshot;
  selectedVersion: string;
  onSelectVersion: (version: string) => void;
  onCompareAgainst: (version: string) => void;
}

function VersionsTab({
  snapshot,
  selectedVersion,
  onSelectVersion,
  onCompareAgainst,
}: VersionsTabProps) {
  return (
    <div className="flex flex-col gap-2">
      <SectionHeader
        title="All versions"
        subtitle="Each row is an immutable artifact. configHash never changes once published."
      />
      <div className="rounded-[4px] border border-hairline-strong bg-l-surface-raised">
        {snapshot.versions.map((version, index) => (
          <AgentVersionRow
            key={version.artifact.artifactId}
            version={version}
            isActive={selectedVersion === version.artifact.version}
            hideCompare={index === 0}
            onOpen={onSelectVersion}
            onCompare={onCompareAgainst}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Section header ──────────────────────────────────────── */

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
