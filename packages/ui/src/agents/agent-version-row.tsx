"use client";

import * as React from "react";
import { ArrowLeftRight, GitCommitVertical } from "lucide-react";

import { cx } from "../utils/cx";
import { Button } from "../primitives/button";
import { formatNumber, RelativeTime } from "../connections/time";

import { AgentConfigHashChip } from "./agent-config-hash-chip";
import { AgentModelLabel } from "./agent-model-label";
import { AgentVersionBadge } from "./agent-version-badge";
import type { AgentVersionSummary } from "./types";

/*
 * AgentVersionRow — single row in the Versions tab. Shows the semver
 * chip, the configHash, the model label, the tool count, the
 * publishedBy/gitSha, the run roll-up (count + success rate), and a
 * "Compare" affordance that opens the diff against the most recent
 * version.
 *
 * Selection (`isActive`) is used by the inline timeline rail in the
 * Overview tab to highlight the version being inspected.
 */

export interface AgentVersionRowProps {
  version: AgentVersionSummary;
  /** Active selection — used in the Versions tab and the timeline rail. */
  isActive?: boolean;
  /** When true, hides the "Compare" affordance — used on the most
   *  recent version where compare-against-itself is meaningless. */
  hideCompare?: boolean;
  onOpen?: (version: string) => void;
  onCompare?: (version: string) => void;
  className?: string;
}

export function AgentVersionRow({
  version,
  isActive,
  hideCompare,
  onOpen,
  onCompare,
  className,
}: AgentVersionRowProps) {
  const { artifact } = version;

  const successPct = Math.round(version.successRate * 100);
  const successTone =
    successPct >= 95
      ? "text-event-green"
      : successPct >= 80
        ? "text-event-amber"
        : "text-event-red";

  return (
    <div
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={
        onOpen
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen(artifact.version);
              }
            }
          : undefined
      }
      onClick={onOpen ? () => onOpen(artifact.version) : undefined}
      data-active={isActive || undefined}
      className={cx(
        "group relative grid items-center gap-3 px-4",
        "grid-cols-[28px_minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(0,1fr)_72px_72px_88px]",
        "h-12 border-b border-l-border-faint last:border-b-0 first:rounded-t-[4px] last:rounded-b-[4px]",
        "font-sans text-[13px] text-l-ink",
        onOpen
          ? "cursor-pointer hover:bg-l-surface-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember/40"
          : null,
        isActive
          ? "bg-l-surface-selected before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[2px] before:bg-ember"
          : null,
        className,
      )}
    >
      <span
        aria-hidden
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[3px] bg-l-surface-input text-l-ink-dim"
      >
        <GitCommitVertical className="size-3.5" strokeWidth={1.6} />
      </span>

      <div className="flex min-w-0 flex-col gap-[1px]">
        <span className="flex items-center gap-2">
          <AgentVersionBadge
            version={artifact.version}
            status={version.status}
          />
          <AgentConfigHashChip hash={artifact.configHash} tone="subtle" />
        </span>
        <span className="truncate font-mono text-[10.5px] text-l-ink-dim">
          {artifact.provenance.publishedBy ? (
            <>
              {artifact.provenance.publishedBy}
              {" · "}
            </>
          ) : null}
          {artifact.provenance.gitSha ? (
            <span className="truncate">@{artifact.provenance.gitSha}</span>
          ) : null}
          {artifact.provenance.aiSdkVersion ? (
            <>
              {" · "}
              <span className="text-l-ink-dim">
                ai sdk {artifact.provenance.aiSdkVersion}
              </span>
            </>
          ) : null}
          {artifact.provenance.frameworkVersion ? (
            <>
              {" · "}
              <span className="text-l-ink-dim">
                fw {artifact.provenance.frameworkVersion}
              </span>
            </>
          ) : null}
        </span>
      </div>

      <span className="flex min-w-0 flex-col gap-[1px]">
        <AgentModelLabel model={artifact.model} size="xs" />
        {version.resolvedModelIds.length > 0 ? (
          <span className="truncate font-mono text-[10px] text-l-ink-dim">
            resolves to {version.resolvedModelIds.slice(0, 2).join(", ")}
            {version.resolvedModelIds.length > 2
              ? ` +${version.resolvedModelIds.length - 2}`
              : ""}
          </span>
        ) : null}
      </span>

      <span className="flex min-w-0 items-center gap-1.5 truncate font-sans text-[12px] text-l-ink-dim">
        {artifact.tools.length === 0
          ? "no tools"
          : `${artifact.tools.length} tool${artifact.tools.length === 1 ? "" : "s"}`}
        {artifact.policy?.maxSteps ? (
          <>
            <span aria-hidden>·</span>
            <span>maxSteps {artifact.policy.maxSteps}</span>
          </>
        ) : null}
      </span>

      <span className="text-right font-sans text-[12px] text-l-ink-lo">
        {formatNumber(version.runCount)}
        <span className="ml-1 text-l-ink-dim">runs</span>
      </span>

      <span
        className={cx(
          "text-right font-sans text-[12px]",
          version.runCount === 0 ? "text-l-ink-dim" : successTone,
        )}
      >
        {version.runCount === 0 ? "—" : `${successPct}%`}
      </span>

      <span
        className="flex items-center justify-end"
        onClick={(e) => e.stopPropagation()}
      >
        {hideCompare ? (
          <span className="font-sans text-[11px] text-l-ink-dim">
            <RelativeTime
              iso={artifact.provenance.createdAt}
              fallback="—"
            />
          </span>
        ) : (
          <Button
            density="compact"
            variant="ghost"
            size="sm"
            onPress={() => onCompare?.(artifact.version)}
            leadingIcon={<ArrowLeftRight className="size-3.5" strokeWidth={1.75} />}
          >
            Compare
          </Button>
        )}
      </span>
    </div>
  );
}
