"use client";

import * as React from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

import { cx } from "../utils/cx";
import { NativeSelect } from "../primitives/native-select";

import { AgentConfigHashChip } from "./agent-config-hash-chip";
import { AgentModelLabel } from "./agent-model-label";
import { AgentVersionBadge } from "./agent-version-badge";
import { HashDomainChip } from "./hash-domain-chip";
import { diffArtifacts, diffDomainStatus } from "./data";
import { HASH_DOMAIN_META } from "./framework-meta";
import { ARTIFACT_HASH_DOMAINS } from "./types";
import type {
  AgentArtifact,
  AgentManifestDiffRow,
  AgentVersionSummary,
  HashDomain,
} from "./types";

/*
 * AgentVersionCompare — structured diff between two artifacts grouped
 * by hash domain.
 *
 *   ┌── prompt ─────────────── changed ┐
 *   │   instructions:                  │
 *   │     - "You are a concise..."     │
 *   │     + "You are a precise..."     │
 *   │   instructionsHash:              │
 *   │     - sha256:4e35338a…           │
 *   │     + sha256:8a91f4c2…           │
 *   └──────────────────────────────────┘
 *
 *   ┌── model.contract ─────── same ───┐
 *   │   model.modelId: gpt-4.1-mini    │
 *   └──────────────────────────────────┘
 *
 * Two version pickers at the top let the user re-anchor either side
 * of the diff. Each domain section is collapsible; "same" sections
 * collapse by default.
 */

export interface AgentVersionCompareProps {
  versions: readonly AgentVersionSummary[];
  fromVersion: string;
  toVersion: string;
  onFromChange?: (version: string) => void;
  onToChange?: (version: string) => void;
  className?: string;
}

export function AgentVersionCompare({
  versions,
  fromVersion,
  toVersion,
  onFromChange,
  onToChange,
  className,
}: AgentVersionCompareProps) {
  const before = versions.find((v) => v.artifact.version === fromVersion)
    ?.artifact;
  const after = versions.find((v) => v.artifact.version === toVersion)
    ?.artifact;

  if (!before || !after) {
    return (
      <div
        className={cx(
          "rounded-[4px] border border-l-border-faint bg-l-wash-1 p-6 text-center font-sans text-[12px] text-l-ink-dim",
          className,
        )}
      >
        Pick two versions to compare.
      </div>
    );
  }

  const rows = diffArtifacts(before, after);
  const sameAll = rows.every((r) => r.unchanged);
  const changedCount = rows.filter((r) => !r.unchanged).length;

  return (
    <div className={cx("flex flex-col gap-4", className)}>
      <div className="flex flex-wrap items-end gap-3 rounded-[4px] border border-l-border-faint bg-l-wash-1 p-3">
        <VersionPicker
          label="From"
          versions={versions}
          value={fromVersion}
          onChange={onFromChange}
        />
        <ArrowRight
          className="mb-1 size-3.5 shrink-0 text-l-ink-dim"
          strokeWidth={1.75}
          aria-hidden
        />
        <VersionPicker
          label="To"
          versions={versions}
          value={toVersion}
          onChange={onToChange}
        />

        <div className="ml-auto flex items-center gap-2 font-sans text-[12px] text-l-ink-dim">
          {sameAll ? (
            <span className="flex items-center gap-1 text-event-green">
              <Check className="size-3.5" strokeWidth={1.75} />
              Identical
            </span>
          ) : (
            <span className="text-event-amber">
              {changedCount} change{changedCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_minmax(0,260px)]">
        <div className="flex flex-col gap-2">
          {ARTIFACT_HASH_DOMAINS.map((domain) => (
            <DomainSection
              key={domain}
              domain={domain}
              rows={rows.filter((r) => r.domain === domain)}
              before={before}
              after={after}
              status={diffDomainStatus(rows, domain)}
            />
          ))}
        </div>

        <aside className="flex flex-col gap-3 self-start rounded-[4px] border border-hairline-strong bg-l-surface-raised p-3.5">
          <h4 className="font-sans text-[13px] font-medium text-l-ink">
            Identity
          </h4>
          <ArtifactSummary artifact={before} label="Before" />
          <hr className="border-t border-l-border-faint" />
          <ArtifactSummary artifact={after} label="After" />
        </aside>
      </div>
    </div>
  );
}

interface VersionPickerProps {
  label: string;
  versions: readonly AgentVersionSummary[];
  value: string;
  onChange?: (version: string) => void;
}

function VersionPicker({
  label,
  versions,
  value,
  onChange,
}: VersionPickerProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-sans text-[11px] text-l-ink-dim">{label}</span>
      <NativeSelect
        value={value}
        onChange={(e) => onChange?.(e.currentTarget.value)}
        className="min-w-[160px]"
      >
        {versions.map((v) => (
          <option key={v.artifact.version} value={v.artifact.version}>
            v{v.artifact.version}
            {v.status === "current" ? " · current" : ""}
            {v.status === "deprecated" ? " · deprecated" : ""}
          </option>
        ))}
      </NativeSelect>
    </label>
  );
}

interface DomainSectionProps {
  domain: HashDomain;
  rows: readonly AgentManifestDiffRow[];
  before: AgentArtifact;
  after: AgentArtifact;
  status: "same" | "changed";
}

function DomainSection({ domain, rows, status }: DomainSectionProps) {
  const [open, setOpen] = React.useState(status === "changed");
  const meta = HASH_DOMAIN_META[domain];
  const Icon = meta.Icon;

  const changedRows = rows.filter((r) => !r.unchanged);

  return (
    <section
      data-status={status}
      className={cx(
        "overflow-hidden rounded-[4px] border bg-l-surface-raised",
        status === "changed"
          ? "border-event-amber/40"
          : "border-hairline-strong",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cx(
          "flex w-full items-center gap-2 px-3 py-2.5",
          "hover:bg-l-surface-hover focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-2px] focus-visible:outline-ember",
        )}
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="size-3.5 text-l-ink-dim" strokeWidth={1.75} />
        ) : (
          <ChevronRight className="size-3.5 text-l-ink-dim" strokeWidth={1.75} />
        )}
        <Icon className={cx(meta.ink, "size-3.5")} strokeWidth={1.75} />
        <span className="font-sans text-[13px] font-medium text-l-ink">
          {meta.label}
        </span>
        <HashDomainChip domain={domain} inline size="sm" />
        <span
          className={cx(
            "ml-auto inline-flex items-center gap-1 font-sans text-[11px]",
            status === "changed"
              ? "text-event-amber"
              : "text-event-green",
          )}
        >
          {status === "changed" ? (
            <AlertTriangle
              className="size-3 shrink-0"
              strokeWidth={2}
              aria-hidden
            />
          ) : (
            <Check className="size-3 shrink-0" strokeWidth={2} aria-hidden />
          )}
          {status === "changed"
            ? `${changedRows.length} changed`
            : "No changes"}
        </span>
      </button>
      {open ? (
        <div className="border-t border-l-border-faint">
          {rows.length === 0 ? (
            <div className="px-3 py-3 font-sans text-[12px] text-l-ink-dim">
              No fields tracked under this domain.
            </div>
          ) : (
            <ul className="divide-y divide-l-border-faint">
              {rows.map((row) => (
                <DiffRow key={`${row.domain}:${row.path}`} row={row} />
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}

function DiffRow({ row }: { row: AgentManifestDiffRow }) {
  return (
    <li
      data-changed={!row.unchanged || undefined}
      className={cx(
        "flex flex-col gap-2 px-3 py-2.5",
        !row.unchanged && "bg-event-amber/[0.04]",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="truncate font-mono text-[11px] text-l-ink-dim">
          {row.path}
        </span>
        {row.unchanged ? (
          <span className="ml-auto inline-flex items-center gap-1 font-sans text-[11px] text-event-green">
            <Check className="size-3 shrink-0" strokeWidth={2} aria-hidden />
            Same
          </span>
        ) : (
          <span className="ml-auto inline-flex items-center gap-1 font-sans text-[11px] text-event-amber">
            <AlertTriangle
              className="size-3 shrink-0"
              strokeWidth={2}
              aria-hidden
            />
            Changed
          </span>
        )}
      </div>

      {row.unchanged ? (
        <pre className="overflow-x-auto rounded-[3px] bg-l-surface-input px-2 py-1.5 font-mono text-[11px] text-l-ink-lo">
          {formatValue(row.before)}
        </pre>
      ) : (
        <div className="grid gap-1.5 sm:grid-cols-2">
          <DiffSide label="Before" value={row.before} tone="removed" />
          <DiffSide label="After" value={row.after} tone="added" />
        </div>
      )}
    </li>
  );
}

function DiffSide({
  label,
  value,
  tone,
}: {
  label: string;
  value: unknown;
  tone: "removed" | "added";
}) {
  return (
    <div
      className={cx(
        "rounded-[3px] border px-2 py-1.5",
        tone === "removed"
          ? "border-event-red/30 bg-event-red/[0.05]"
          : "border-event-green/30 bg-event-green/[0.05]",
      )}
    >
      <div className="mb-1 flex items-center gap-1 font-sans text-[10.5px] text-l-ink-dim">
        <span
          aria-hidden
          className={cx(
            tone === "removed" ? "text-event-red" : "text-event-green",
          )}
        >
          {tone === "removed" ? "−" : "+"}
        </span>
        {label}
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-snug text-l-ink-lo">
        {formatValue(value)}
      </pre>
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

interface ArtifactSummaryProps {
  artifact: AgentArtifact;
  label: string;
}

function ArtifactSummary({ artifact, label }: ArtifactSummaryProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="font-sans text-[11px] text-l-ink-dim">{label}</span>
        <AgentVersionBadge version={artifact.version} />
      </div>
      <AgentConfigHashChip
        hash={artifact.configHash}
        label="config"
        tone="subtle"
        leading={6}
        trailing={6}
      />
      <AgentModelLabel model={artifact.model} size="xs" />
      <span className="font-sans text-[11px] text-l-ink-dim">
        {artifact.tools.length} tool
        {artifact.tools.length === 1 ? "" : "s"}
        {artifact.policy?.maxSteps != null
          ? ` · maxSteps ${artifact.policy.maxSteps}`
          : ""}
      </span>
      <span className="font-sans text-[11px] text-l-ink-dim">
        {artifact.provenance.publishedBy ?? "—"}
        {artifact.provenance.gitSha ? (
          <>
            {" · "}
            <span className="font-mono">@{artifact.provenance.gitSha}</span>
          </>
        ) : null}
      </span>
    </div>
  );
}
