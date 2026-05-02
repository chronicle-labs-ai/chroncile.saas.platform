"use client";

import * as React from "react";
import { CheckCircle2, ShieldAlert, ShieldCheck, Wrench } from "lucide-react";

import { cx } from "../utils/cx";
import { Chip } from "../primitives/chip";

import { AgentConfigHashChip } from "./agent-config-hash-chip";
import { AgentVersionBadge } from "./agent-version-badge";
import type { AgentToolDefinition, AgentVersionSummary } from "./types";

/*
 * AgentToolsPanel — per-version tool inventory.
 *
 * Each tool card shows:
 *   - tool name + description
 *   - inputSchemaHash chip (click-to-copy)
 *   - "Allowed by policy" pill when in allowedTools
 *   - "Requires approval" pill when in approvalRequired
 *   - the input schema preview (if carried by the artifact)
 *
 * Above the cards: per-version pill bar so the customer can switch
 * between versions without leaving the tab. Mirrors the runtime
 * policy summary — maxSteps, allowedTools count.
 */

export interface AgentToolsPanelProps {
  version: AgentVersionSummary | null;
  versions: readonly AgentVersionSummary[];
  selectedVersion: string;
  onSelectVersion: (version: string) => void;
  className?: string;
}

export function AgentToolsPanel({
  version,
  versions,
  selectedVersion,
  onSelectVersion,
  className,
}: AgentToolsPanelProps) {
  if (!version) {
    return (
      <div
        className={cx(
          "rounded-[4px] border border-l-border-faint bg-l-wash-1 p-6 text-center font-mono text-[11px] text-l-ink-dim",
          className,
        )}
      >
        No version selected.
      </div>
    );
  }

  const policy = version.artifact.policy;
  const allowed = new Set(policy?.allowedTools ?? []);
  const approval = new Set(policy?.approvalRequired ?? []);

  return (
    <div className={cx("flex flex-col gap-4", className)}>
      {versions.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-[3px] border border-l-border-faint bg-l-wash-1 px-3 py-2">
          <span className="font-sans text-[11px] text-l-ink-dim">Version</span>
          {versions.map((v) => (
            <Chip
              key={v.artifact.version}
              density="compact"
              active={selectedVersion === v.artifact.version}
              onClick={() => onSelectVersion(v.artifact.version)}
            >
              v{v.artifact.version}
            </Chip>
          ))}
          <span className="ml-auto font-sans text-[11px] text-l-ink-dim">
            {version.artifact.tools.length} tool
            {version.artifact.tools.length === 1 ? "" : "s"}
            {policy?.maxSteps != null
              ? ` · maxSteps ${policy.maxSteps}`
              : ""}
          </span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_minmax(0,260px)]">
        <div className="flex flex-col gap-2">
          {version.artifact.tools.length === 0 ? (
            <div className="rounded-[4px] border border-l-border-faint bg-l-wash-1 p-6 text-center font-sans text-[12px] text-l-ink-dim">
              <Wrench
                className="mx-auto mb-1 size-4 text-l-ink-dim"
                strokeWidth={1.5}
              />
              This version has no tools.
            </div>
          ) : (
            version.artifact.tools.map((tool) => (
              <ToolCard
                key={tool.name}
                tool={tool}
                allowed={allowed.has(tool.name)}
                requiresApproval={approval.has(tool.name)}
              />
            ))
          )}
        </div>

        <aside className="flex flex-col gap-3 self-start rounded-[4px] border border-l-border bg-l-surface-raised p-3.5">
          <h4 className="font-sans text-[13px] font-medium text-l-ink">
            Runtime policy
          </h4>
          <div className="flex items-center gap-2">
            <AgentVersionBadge
              version={version.artifact.version}
              status={version.status}
            />
          </div>
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
          <hr className="border-t border-l-border-faint" />
          <h4 className="font-sans text-[13px] font-medium text-l-ink">
            Provenance
          </h4>
          <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5">
            <PolicyRow
              label="AI SDK version"
              value={version.artifact.provenance.aiSdkVersion ?? "—"}
              mono
            />
            <PolicyRow
              label="Framework"
              value={version.artifact.provenance.frameworkVersion ?? "—"}
              mono
            />
            <PolicyRow
              label="Git SHA"
              value={version.artifact.provenance.gitSha ?? "—"}
              mono
            />
          </dl>
        </aside>
      </div>
    </div>
  );
}

interface ToolCardProps {
  tool: AgentToolDefinition;
  allowed: boolean;
  requiresApproval: boolean;
}

function ToolCard({ tool, allowed, requiresApproval }: ToolCardProps) {
  return (
    <article
      data-allowed={allowed || undefined}
      data-approval={requiresApproval || undefined}
      className={cx(
        "rounded-[4px] border bg-l-surface-raised px-3 py-2.5",
        allowed ? "border-l-border" : "border-event-amber/40",
      )}
    >
      <div className="flex items-start gap-2">
        <span
          aria-hidden
          className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-[3px] bg-event-violet/10 text-event-violet"
        >
          <Wrench className="size-3.5" strokeWidth={1.6} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[13px] font-medium text-l-ink">
              {tool.name}
            </span>
            {allowed ? (
              <span className="inline-flex items-center gap-1 rounded-pill border border-event-green/30 bg-event-green/10 px-2 py-[1px] font-sans text-[11px] text-event-green">
                <ShieldCheck className="size-2.5" strokeWidth={1.75} />
                Allowed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-pill border border-event-amber/30 bg-event-amber/10 px-2 py-[1px] font-sans text-[11px] text-event-amber">
                <ShieldAlert className="size-2.5" strokeWidth={1.75} />
                Not in allowedTools
              </span>
            )}
            {requiresApproval ? (
              <span className="inline-flex items-center gap-1 rounded-pill border border-event-orange/30 bg-event-orange/10 px-2 py-[1px] font-sans text-[11px] text-event-orange">
                <CheckCircle2 className="size-2.5" strokeWidth={1.75} />
                Requires approval
              </span>
            ) : null}
          </div>
          {tool.description ? (
            <p className="font-sans text-[12px] leading-snug text-l-ink-lo">
              {tool.description}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            {tool.inputSchemaHash ? (
              <AgentConfigHashChip
                hash={tool.inputSchemaHash}
                label="schema"
                tone="subtle"
              />
            ) : null}
          </div>
          {tool.inputSchemaPreview ? (
            <details className="rounded-[3px] border border-l-border-faint bg-l-surface-input/40 p-2 open:bg-l-surface-input">
              <summary className="cursor-pointer font-sans text-[11px] text-l-ink-dim">
                Input schema
              </summary>
              <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-snug text-l-ink-lo">
                {JSON.stringify(tool.inputSchemaPreview, null, 2)}
              </pre>
            </details>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function PolicyRow({
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
      <dt className="font-sans text-[12px] text-l-ink-dim">{label}</dt>
      <dd
        className={cx(
          "min-w-0 truncate text-[12px] text-l-ink-lo",
          mono ? "font-mono" : "font-sans",
        )}
      >
        {value}
      </dd>
    </>
  );
}
