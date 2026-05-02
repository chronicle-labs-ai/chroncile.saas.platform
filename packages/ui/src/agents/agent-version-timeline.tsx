"use client";

import * as React from "react";
import { GitCommitVertical } from "lucide-react";

import { cx } from "../utils/cx";
import { formatNumber, RelativeTime } from "../connections/time";

import { AgentModelLabel } from "./agent-model-label";
import { AgentVersionBadge } from "./agent-version-badge";
import type { AgentVersionSummary } from "./types";

/*
 * AgentVersionTimeline — vertical rail rendered on the Overview tab,
 * showing every version of an agent ordered newest first. Each entry
 * is a click target that selects the version; the rail itself is
 * decorative (1px hairline running through the dots).
 *
 *    │
 *    ●  v1.2.0  current   12 runs · 92% ok  · 4d ago
 *    │  gpt-4.1
 *    ●  v1.1.0  stable     9 runs · 88% ok  · 14d ago
 *    │  gpt-4.1-mini
 *    ●  v1.0.0  deprecated 6 runs · 83% ok  · 28d ago
 */

export interface AgentVersionTimelineProps {
  versions: readonly AgentVersionSummary[];
  selectedVersion?: string;
  onSelectVersion?: (version: string) => void;
  className?: string;
}

export function AgentVersionTimeline({
  versions,
  selectedVersion,
  onSelectVersion,
  className,
}: AgentVersionTimelineProps) {
  if (versions.length === 0) {
    return (
      <div
        className={cx(
          "rounded-[4px] border border-l-border-faint bg-l-wash-1 p-6 text-center",
          className,
        )}
      >
        <span className="font-sans text-[12px] text-l-ink-dim">
          No versions published yet.
        </span>
      </div>
    );
  }

  return (
    <ol
      className={cx(
        "relative rounded-[4px] border border-l-border bg-l-surface-raised",
        className,
      )}
    >
      {versions.map((v, index) => (
        <li
          key={v.artifact.artifactId}
          className="relative flex items-stretch"
        >
          {/* Vertical rail. */}
          <div
            aria-hidden
            className={cx(
              "relative flex w-8 shrink-0 justify-center",
              index === 0 && "pt-3",
              index === versions.length - 1 && "pb-3",
            )}
          >
            <span
              className={cx(
                "absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-l-border-faint",
                index === 0 && "top-3",
                index === versions.length - 1 && "h-[calc(100%-12px)]",
              )}
            />
            <span
              className={cx(
                "relative z-10 mt-3 flex size-4 items-center justify-center rounded-pill border bg-l-surface-raised",
                v.status === "current"
                  ? "border-ember text-ember"
                  : "border-l-border text-l-ink-dim",
              )}
            >
              <GitCommitVertical className="size-2.5" strokeWidth={2} />
            </span>
          </div>

          <button
            type="button"
            onClick={() => onSelectVersion?.(v.artifact.version)}
            data-active={selectedVersion === v.artifact.version || undefined}
            className={cx(
              "flex flex-1 flex-col gap-1.5 border-b border-l-border-faint px-3 py-3 text-left",
              "last:border-b-0",
              "hover:bg-l-surface-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember/40",
              selectedVersion === v.artifact.version &&
                "bg-l-surface-selected",
            )}
          >
            <div className="flex items-center gap-2">
              <AgentVersionBadge
                version={v.artifact.version}
                status={v.status}
              />
              <AgentModelLabel model={v.artifact.model} size="xs" />
              <span className="ml-auto font-sans text-[11px] text-l-ink-dim">
                <RelativeTime
                  iso={v.artifact.provenance.createdAt}
                  fallback="—"
                />
              </span>
            </div>
            <div className="flex items-center gap-2 font-sans text-[11px] text-l-ink-dim">
              <span>{formatNumber(v.runCount)} runs</span>
              <span aria-hidden>·</span>
              <span>
                {v.runCount === 0
                  ? "no runs"
                  : `${Math.round(v.successRate * 100)}% ok`}
              </span>
              {v.artifact.tools.length > 0 ? (
                <>
                  <span aria-hidden>·</span>
                  <span>
                    {v.artifact.tools.length} tool
                    {v.artifact.tools.length === 1 ? "" : "s"}
                  </span>
                </>
              ) : null}
              {v.resolvedModelIds.length > 1 ? (
                <>
                  <span aria-hidden>·</span>
                  <span className="text-event-amber">
                    {v.resolvedModelIds.length} resolved ids
                  </span>
                </>
              ) : null}
            </div>
            {v.artifact.description ? (
              <p className="line-clamp-2 font-sans text-[12px] leading-snug text-l-ink-lo">
                {v.artifact.description}
              </p>
            ) : null}
          </button>
        </li>
      ))}
    </ol>
  );
}
