"use client";

import * as React from "react";
import {
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Database,
  FileText,
  Hash,
  Network,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";

import { cx } from "../utils/cx";
import { formatStableDateTime } from "../connections/time";

import { AgentConfigHashChip } from "./agent-config-hash-chip";
import { AgentModelLabel } from "./agent-model-label";
import { AgentVersionBadge } from "./agent-version-badge";
import { AgentWorkflowGraphPreview } from "./agent-workflow-graph-preview";
import type {
  AgentContractPreview,
  AgentKnowledgeKind,
  AgentKnowledgeSource,
  AgentSnapshot,
  AgentToolDefinition,
  AgentVersionSummary,
} from "./types";

/*
 * AgentConfigCanvas — single-column "what is this agent" canvas. The
 * rewrite drops the right rail (Pulse, Version timeline, Recent runs,
 * Drift summary) because every one of those panels duplicates a
 * dedicated tab on `AgentDetailPage` (Versions / Runs / Drift). The
 * Configuration tab now answers exactly one question: how is this
 * agent configured at the selected version?
 *
 *   ┌──────────────────────────────────────────────────────┐
 *   │  Persona & Prompt                                    │
 *   │  Capabilities (workflow + tools + I/O contracts)     │
 *   │  Knowledge & Policy                                  │
 *   │  Provenance & Hashes                                 │
 *   └──────────────────────────────────────────────────────┘
 *
 * Constrained to `max-w-3xl` so long prompts don't run a 12-column
 * grid wide on big monitors. Read-only over an `AgentVersionSummary`
 * — switching the version slot re-renders every section.
 */

export interface AgentConfigCanvasProps {
  snapshot: AgentSnapshot;
  /** Version that drives the canvas. */
  selectedVersion?: string;
  onSelectVersion?: (version: string) => void;
  selectedRunId?: string | null;
  onSelectRun?: (runId: string | null) => void;
  /** Tab-jump callbacks are accepted for API back-compat but no longer
   *  rendered — the canvas no longer surfaces "View all" affordances
   *  inside the configuration view. */
  onJumpToVersionsTab?: () => void;
  onJumpToRunsTab?: () => void;
  onJumpToDriftTab?: () => void;
  onOpenHashSearch?: (hint?: string) => void;
  className?: string;
}

export function AgentConfigCanvas({
  snapshot,
  selectedVersion,
  onSelectVersion: _onSelectVersion,
  selectedRunId: _selectedRunId,
  onSelectRun: _onSelectRun,
  onJumpToVersionsTab: _onJumpToVersionsTab,
  onJumpToRunsTab: _onJumpToRunsTab,
  onJumpToDriftTab: _onJumpToDriftTab,
  onOpenHashSearch,
  className,
}: AgentConfigCanvasProps) {
  const versions = snapshot.versions;
  const fallbackSelected =
    versions.find((v) => v.status === "current")?.artifact.version ??
    versions[0]?.artifact.version ??
    "";
  const activeVersion = selectedVersion ?? fallbackSelected;
  const activeSummary = React.useMemo<AgentVersionSummary | null>(
    () =>
      versions.find((v) => v.artifact.version === activeVersion) ??
      versions[0] ??
      null,
    [versions, activeVersion],
  );

  return (
    <div
      className={cx(
        "mx-auto flex w-full max-w-3xl flex-col gap-4",
        className,
      )}
    >
      {activeSummary ? (
        <PersonaPromptSection
          summary={snapshot.summary}
          version={activeSummary}
          onOpenHashSearch={onOpenHashSearch}
        />
      ) : null}

      {activeSummary ? (
        <CapabilitiesSection version={activeSummary} />
      ) : null}

      {activeSummary ? (
        <KnowledgePolicySection version={activeSummary} />
      ) : null}

      {activeSummary ? (
        <ProvenanceSection
          version={activeSummary}
          onOpenHashSearch={onOpenHashSearch}
        />
      ) : null}
    </div>
  );
}

/* ── Left rail · Persona & Prompt ────────────────────────── */

interface PersonaPromptSectionProps {
  /** Summary carries the canvas-level persona blurb + capability tags.
   *  These used to live in the detail page hero; the redesign moved
   *  them here so the header could shrink to a one-line band. */
  summary: AgentSnapshot["summary"];
  version: AgentVersionSummary;
  onOpenHashSearch?: (hint?: string) => void;
}

function PersonaPromptSection({
  summary,
  version,
  onOpenHashSearch,
}: PersonaPromptSectionProps) {
  const [expanded, setExpanded] = React.useState(false);
  const instructions = version.artifact.instructions ?? "";
  const long = instructions.length > 320;
  const persona = summary.personaSummary;
  const tags = summary.capabilityTags ?? [];

  return (
    <Section
      icon={<Sparkles className="size-3.5" strokeWidth={1.75} />}
      title="Persona & Prompt"
      subtitle={
        <span className="flex items-center gap-1.5">
          <AgentVersionBadge
            version={version.artifact.version}
            status={version.status}
          />
          <AgentModelLabel model={version.artifact.model} size="xs" />
        </span>
      }
    >
      {persona ? (
        <p className="font-sans text-[12.5px] leading-5 text-l-ink-lo">
          {persona}
        </p>
      ) : null}

      {tags.length > 0 ? (
        <ul className="flex flex-wrap items-center gap-1.5">
          {tags.map((tag) => (
            <li
              key={tag}
              className="inline-flex items-center rounded-[2px] border border-l-border-faint bg-l-wash-1 px-1.5 py-[1px] font-mono text-[10.5px] tabular-nums text-l-ink-lo"
            >
              {tag}
            </li>
          ))}
        </ul>
      ) : null}

      {instructions ? (
        <div
          className={cx(
            "relative rounded-[3px] border border-l-border-faint bg-l-surface-input/40 p-3",
          )}
        >
          <pre
            className={cx(
              "overflow-hidden whitespace-pre-wrap break-words font-mono text-[12px] leading-snug text-l-ink-lo",
              !expanded && long && "max-h-[126px]",
            )}
          >
            {instructions}
          </pre>
          {long ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className={cx(
                "mt-2 inline-flex items-center gap-1 font-sans text-[11px] text-l-ink-lo",
                "transition-colors duration-fast",
                "hover:text-l-ink",
                "focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-ember",
              )}
            >
              {expanded ? (
                <>
                  <ChevronDown className="size-3" strokeWidth={1.75} />
                  Show less
                </>
              ) : (
                <>
                  <ChevronRight className="size-3" strokeWidth={1.75} />
                  Show full prompt
                </>
              )}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="rounded-[3px] border border-l-border-faint bg-l-wash-1 p-3 font-sans text-[12px] text-l-ink-dim">
          No instructions on this artifact.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {version.artifact.instructionsHash ? (
          <AgentConfigHashChip
            hash={version.artifact.instructionsHash}
            label="prompt"
          />
        ) : null}
        {version.artifact.providerOptionsHash ? (
          <AgentConfigHashChip
            hash={version.artifact.providerOptionsHash}
            label="options"
          />
        ) : null}
        {onOpenHashSearch ? (
          <button
            type="button"
            onClick={() =>
              onOpenHashSearch(version.artifact.instructionsHash ?? "")
            }
            className={cx(
              "inline-flex items-center gap-1 rounded-[2px] border border-l-border-faint bg-l-wash-1 px-1.5 py-[1px] font-mono text-[10px] text-l-ink-dim",
              "transition-colors duration-fast",
              "hover:border-l-border-strong hover:text-l-ink",
              "focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-ember",
            )}
          >
            <Hash className="size-2.5" strokeWidth={1.75} />
            Find similar
          </button>
        ) : null}
      </div>
    </Section>
  );
}

/* ── Left rail · Capabilities ────────────────────────────── */

interface CapabilitiesSectionProps {
  version: AgentVersionSummary;
}

function CapabilitiesSection({ version }: CapabilitiesSectionProps) {
  const tools = version.artifact.tools;
  const policy = version.artifact.policy;
  const allowed = new Set(policy?.allowedTools ?? []);
  const approval = new Set(policy?.approvalRequired ?? []);
  const graph = version.artifact.workflowGraphPreview;
  const inputContract = version.artifact.inputContractPreview;
  const outputContract = version.artifact.outputContractPreview;

  return (
    <Section
      icon={<Wrench className="size-3.5" strokeWidth={1.75} />}
      title="Capabilities"
      subtitle={
        <span>
          {tools.length} tool{tools.length === 1 ? "" : "s"}
          {policy?.maxSteps != null ? ` · maxSteps ${policy.maxSteps}` : ""}
        </span>
      }
    >
      {graph ? (
        <AgentWorkflowGraphPreview
          graph={graph}
          density="default"
          ariaLabel={`Workflow graph for ${version.artifact.name} v${version.artifact.version}`}
        />
      ) : null}

      {tools.length === 0 ? (
        <div className="rounded-[3px] border border-l-border-faint bg-l-wash-1 p-3 text-center font-sans text-[12px] text-l-ink-dim">
          This version has no tools.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {tools.map((tool) => (
            <ToolListItem
              key={tool.name}
              tool={tool}
              allowed={allowed.has(tool.name)}
              requiresApproval={approval.has(tool.name)}
            />
          ))}
        </ul>
      )}

      {(inputContract || outputContract) && (
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {inputContract ? (
            <ContractCard label="Input" contract={inputContract} />
          ) : null}
          {outputContract ? (
            <ContractCard label="Output" contract={outputContract} />
          ) : null}
        </div>
      )}
    </Section>
  );
}

interface ToolListItemProps {
  tool: AgentToolDefinition;
  allowed: boolean;
  requiresApproval: boolean;
}

function ToolListItem({ tool, allowed, requiresApproval }: ToolListItemProps) {
  return (
    <li
      data-allowed={allowed || undefined}
      className={cx(
        "flex items-start gap-2 rounded-[3px] border bg-l-surface-raised px-3 py-2",
        allowed ? "border-hairline-strong" : "border-event-amber/40",
      )}
    >
      <span
        aria-hidden
        className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-[3px] bg-event-violet/10 text-event-violet"
      >
        <Wrench className="size-3" strokeWidth={1.6} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[12px] font-medium text-l-ink">
            {tool.name}
          </span>
          {allowed ? null : (
            <span className="inline-flex items-center gap-1 rounded-pill border border-event-amber/30 bg-event-amber/10 px-1.5 py-[1px] font-sans text-[10px] text-event-amber">
              not in allowedTools
            </span>
          )}
          {requiresApproval ? (
            <span className="inline-flex items-center gap-1 rounded-pill border border-event-orange/30 bg-event-orange/10 px-1.5 py-[1px] font-sans text-[10px] text-event-orange">
              <ShieldCheck className="size-2.5" strokeWidth={1.75} />
              approval required
            </span>
          ) : null}
        </div>
        {tool.description ? (
          <p className="font-sans text-[11px] leading-snug text-l-ink-lo">
            {tool.description}
          </p>
        ) : null}
      </div>
      {tool.inputSchemaHash ? (
        <AgentConfigHashChip
          hash={tool.inputSchemaHash}
          label="schema"
          tone="subtle"
          className="shrink-0"
        />
      ) : null}
    </li>
  );
}

interface ContractCardProps {
  label: string;
  contract: AgentContractPreview;
}

function ContractCard({ label, contract }: ContractCardProps) {
  return (
    <div className="rounded-[3px] border border-l-border-faint bg-l-wash-1 p-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-l-ink-dim">
          {label}
        </span>
        {contract.schemaSummary ? (
          <span className="truncate font-mono text-[10.5px] tabular-nums text-l-ink-lo">
            {contract.schemaSummary}
          </span>
        ) : null}
      </div>
      {contract.example !== undefined ? (
        <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-snug text-l-ink-lo">
          {JSON.stringify(contract.example, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

/* ── Left rail · Knowledge & Policy ──────────────────────── */

const KNOWLEDGE_TONE: Record<AgentKnowledgeKind, string> = {
  doc: "text-event-teal",
  vector: "text-event-violet",
  table: "text-event-amber",
  graph: "text-event-pink",
};

interface KnowledgePolicySectionProps {
  version: AgentVersionSummary;
}

function KnowledgePolicySection({ version }: KnowledgePolicySectionProps) {
  const sources = version.artifact.knowledgeSources ?? [];
  const policy = version.artifact.policy;

  return (
    <Section
      icon={<Database className="size-3.5" strokeWidth={1.75} />}
      title="Knowledge & Policy"
      subtitle={
        <span>
          {sources.length} source{sources.length === 1 ? "" : "s"}
          {policy?.allowedTools && policy.allowedTools.length > 0
            ? ` · ${policy.allowedTools.length} tool${policy.allowedTools.length === 1 ? "" : "s"} allowed`
            : ""}
        </span>
      }
    >
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <SubCard title="Knowledge sources">
          {sources.length === 0 ? (
            <span className="font-sans text-[12px] text-l-ink-dim">
              No knowledge sources bound at config time.
            </span>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {sources.map((s) => (
                <KnowledgeSourceRow key={s.id} source={s} />
              ))}
            </ul>
          )}
        </SubCard>

        <SubCard title="Runtime policy">
          <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5">
            <PolicyRow
              label="Max steps"
              value={
                policy?.maxSteps != null ? String(policy.maxSteps) : "unbounded"
              }
            />
            <PolicyRow
              label="Allowed tools"
              value={
                policy?.allowedTools && policy.allowedTools.length > 0
                  ? policy.allowedTools.join(", ")
                  : "all tools allowed"
              }
            />
            <PolicyRow
              label="Approval required"
              value={
                policy?.approvalRequired && policy.approvalRequired.length > 0
                  ? policy.approvalRequired.join(", ")
                  : "none"
              }
            />
          </dl>
        </SubCard>
      </div>
    </Section>
  );
}

function KnowledgeSourceRow({ source }: { source: AgentKnowledgeSource }) {
  return (
    <li className="flex items-center gap-2 rounded-[3px] border border-l-border-faint bg-l-surface-raised px-2.5 py-1.5">
      <span
        aria-hidden
        className={cx(
          "flex size-5 shrink-0 items-center justify-center rounded-[2px] bg-l-wash-2",
          KNOWLEDGE_TONE[source.kind] ?? "text-l-ink-dim",
        )}
      >
        {source.kind === "graph" ? (
          <Network className="size-3" strokeWidth={1.6} />
        ) : source.kind === "vector" ? (
          <Sparkles className="size-3" strokeWidth={1.6} />
        ) : (
          <FileText className="size-3" strokeWidth={1.6} />
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-sans text-[12px] text-l-ink">
          {source.label}
        </span>
        <span className="truncate font-mono text-[10px] tabular-nums text-l-ink-dim">
          {source.kind}
          {source.sizeLabel ? ` · ${source.sizeLabel}` : ""}
        </span>
      </div>
      {source.href ? (
        <a
          href={source.href}
          className={cx(
            "inline-flex shrink-0 items-center gap-0.5 font-mono text-[10px] text-l-ink-lo",
            "transition-colors duration-fast",
            "hover:text-l-ink",
            "focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-ember",
          )}
        >
          open
          <ArrowUpRight className="size-2.5" strokeWidth={1.75} />
        </a>
      ) : null}
    </li>
  );
}

function PolicyRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="font-sans text-[11px] text-l-ink-dim">{label}</dt>
      <dd className="min-w-0 truncate font-sans text-[12px] text-l-ink-lo">
        {value}
      </dd>
    </>
  );
}

/* ── Left rail · Provenance & Hashes ─────────────────────── */

interface ProvenanceSectionProps {
  version: AgentVersionSummary;
  onOpenHashSearch?: (hint?: string) => void;
}

function ProvenanceSection({
  version,
  onOpenHashSearch,
}: ProvenanceSectionProps) {
  const p = version.artifact.provenance;

  return (
    <Section
      icon={<Hash className="size-3.5" strokeWidth={1.75} />}
      title="Provenance & Hashes"
      subtitle={
        <span className="font-mono text-[10.5px] tabular-nums text-l-ink-dim">
          {formatStableDateTime(p.createdAt)}
        </span>
      }
    >
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <SubCard title="Build">
          <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5">
            <ProvRow label="Published by" value={p.publishedBy ?? "—"} />
            <ProvRow label="Git SHA" value={p.gitSha ?? "—"} mono />
            <ProvRow label="AI SDK" value={p.aiSdkVersion ?? "—"} mono />
            <ProvRow label="Framework" value={p.frameworkVersion ?? "—"} mono />
          </dl>
        </SubCard>

        <SubCard title="Hashes">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-[68px] font-sans text-[11px] text-l-ink-dim">
                config
              </span>
              <AgentConfigHashChip hash={version.artifact.configHash} />
            </div>
            {version.artifact.instructionsHash ? (
              <div className="flex items-center gap-1.5">
                <span className="w-[68px] font-sans text-[11px] text-l-ink-dim">
                  prompt
                </span>
                <AgentConfigHashChip hash={version.artifact.instructionsHash} />
              </div>
            ) : null}
            {version.artifact.providerOptionsHash ? (
              <div className="flex items-center gap-1.5">
                <span className="w-[68px] font-sans text-[11px] text-l-ink-dim">
                  options
                </span>
                <AgentConfigHashChip
                  hash={version.artifact.providerOptionsHash}
                />
              </div>
            ) : null}
            {p.dependencyLockHash ? (
              <div className="flex items-center gap-1.5">
                <span className="w-[68px] font-sans text-[11px] text-l-ink-dim">
                  deps
                </span>
                <AgentConfigHashChip hash={p.dependencyLockHash} />
              </div>
            ) : null}
            {onOpenHashSearch ? (
              <button
                type="button"
                onClick={() => onOpenHashSearch(version.artifact.configHash)}
                className={cx(
                  "mt-1 inline-flex items-center gap-1 self-start font-sans text-[11px] text-l-ink-lo",
                  "transition-colors duration-fast",
                  "hover:text-l-ink",
                  "focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-ember",
                )}
              >
                <Hash className="size-3" strokeWidth={1.75} />
                Open in hash index
              </button>
            ) : null}
          </div>
        </SubCard>
      </div>
    </Section>
  );
}

function ProvRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <>
      <dt className="font-sans text-[11px] text-l-ink-dim">{label}</dt>
      <dd
        className={cx(
          "min-w-0 truncate text-[12px] text-l-ink-lo",
          mono ? "font-mono tabular-nums" : "font-sans",
        )}
      >
        {value}
      </dd>
    </>
  );
}

/* ── Section primitives ──────────────────────────────────── */

interface SectionProps {
  /** Optional leading glyph. The redesign drops the prior 24px tile;
   *  this prop is preserved for API back-compat but ignored. */
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}

function Section({ icon: _icon, title, subtitle, children }: SectionProps) {
  return (
    <section className="flex flex-col gap-3 rounded-[4px] border border-hairline-strong bg-l-surface-raised p-3.5">
      <header className="flex items-baseline justify-between gap-3">
        <h3 className="font-sans text-[13px] font-medium text-l-ink">
          {title}
        </h3>
        {subtitle ? (
          <span className="truncate font-sans text-[11px] text-l-ink-dim">
            {subtitle}
          </span>
        ) : null}
      </header>
      <div className="flex flex-col gap-2.5">{children}</div>
    </section>
  );
}

function SubCard({
  title,
  children,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-[3px] border border-l-border-faint bg-l-wash-1 p-2.5">
      <h4 className="font-mono text-[10px] uppercase tracking-[0.08em] text-l-ink-dim">
        {title}
      </h4>
      {children}
    </div>
  );
}

