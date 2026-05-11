"use client";

import * as React from "react";
import { AlertTriangle, ArrowRight } from "lucide-react";

import { cx } from "../utils/cx";
import { formatStableDateTime, RelativeTime } from "../connections/time";

import { AgentVersionBadge } from "./agent-version-badge";
import { HashDomainChip } from "./hash-domain-chip";
import type { AgentDriftEntry } from "./types";

/*
 * AgentDriftTimeline — chronological list of provider observation
 * transitions:
 *
 *   - "Resolved model id changed"  e.g. gpt-4.1-mini-2025-04-14 → -2025-06-12
 *   - "Service tier shifted"       e.g. default → scale
 *   - "Provider org/project shifted" (optional, future)
 *
 * Each row is anchored to the run that surfaced the change. Click a
 * row to jump to that run in the Runs tab via `onSelectRun`.
 *
 * Empty state: a calm "no drift observed" message — drift detection
 * is on by virtue of recording every run, so absence is success.
 */

export interface AgentDriftTimelineProps {
  entries: readonly AgentDriftEntry[];
  onSelectRun?: (runId: string) => void;
  className?: string;
}

export function AgentDriftTimeline({
  entries,
  onSelectRun,
  className,
}: AgentDriftTimelineProps) {
  if (entries.length === 0) {
    return (
      <div
        className={cx(
          "flex flex-col items-center justify-center gap-2 rounded-[4px] border border-l-border-faint bg-l-wash-1 px-4 py-10 text-center",
          className,
        )}
      >
        <div className="flex size-8 items-center justify-center rounded-pill bg-event-green/10 text-event-green">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="size-4"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              d="M4.5 12.75l6 6 9-13.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h3 className="font-sans text-[13px] font-medium text-l-ink">
          No drift observed
        </h3>
        <p className="max-w-xs font-sans text-[12px] leading-snug text-l-ink-dim">
          Every run resolved to the declared model id and stayed on the same
          service tier. Drift will appear here as soon as it&apos;s detected.
        </p>
      </div>
    );
  }

  return (
    <ol
      className={cx(
        "relative rounded-[4px] border border-hairline-strong bg-l-surface-raised",
        className,
      )}
    >
      {entries.map((entry, index) => (
        <li
          key={`${entry.runId}:${index}`}
          className="relative flex items-stretch"
        >
          <div
            aria-hidden
            className="relative flex w-8 shrink-0 justify-center"
          >
            <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-l-border-faint" />
            <span className="relative z-raised mt-3 flex size-4 items-center justify-center rounded-pill border border-event-amber/45 bg-event-amber/10 text-event-amber">
              <AlertTriangle className="size-2.5" strokeWidth={1.75} />
            </span>
          </div>

          <button
            type="button"
            onClick={() => onSelectRun?.(entry.runId)}
            className={cx(
              "flex flex-1 flex-col gap-2 border-b border-l-border-faint px-4 py-3 text-left",
              "last:border-b-0",
              "hover:bg-l-surface-hover focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-2px] focus-visible:outline-ember",
            )}
          >
            <div className="flex items-center gap-2 font-sans text-[11px] text-l-ink-dim">
              <span>{formatStableDateTime(entry.observedAt)}</span>
              <span aria-hidden>·</span>
              <RelativeTime iso={entry.observedAt} fallback="—" />
              <span aria-hidden>·</span>
              <AgentVersionBadge
                version={
                  entry.artifactId.split("@")[1] ?? entry.artifactId
                }
              />
              <span className="ml-auto font-mono text-l-ink-dim">
                {entry.runId.slice(0, 8)}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <HashDomainChip domain="provider.observation" inline />
              <span className="font-sans text-[13px] font-medium text-l-ink">
                {entry.summary}
              </span>
            </div>
            {(entry.before || entry.after) ? (
              <div className="flex flex-wrap items-center gap-2 font-sans text-[11px]">
                <ValueChip value={entry.before} tone="before" />
                <ArrowRight
                  className="size-3 text-l-ink-dim"
                  strokeWidth={1.75}
                  aria-hidden
                />
                <ValueChip value={entry.after} tone="after" />
              </div>
            ) : null}
          </button>
        </li>
      ))}
    </ol>
  );
}

function ValueChip({
  value,
  tone,
}: {
  value: Record<string, unknown> | undefined;
  tone: "before" | "after";
}) {
  const label = value
    ? Object.entries(value)
        .map(([k, v]) => `${k}: ${formatScalar(v)}`)
        .join(", ")
    : "—";
  // Visible glyph so the diff direction survives without colour.
  // Mirrors the "−" / "+" convention in `AgentVersionCompare`.
  const glyph = tone === "before" ? "−" : "+";
  const sr = tone === "before" ? "Before:" : "After:";
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-[3px] border px-2 py-[2px] font-mono",
        tone === "before"
          ? "border-event-red/30 bg-event-red/[0.05] text-event-red"
          : "border-event-green/30 bg-event-green/[0.05] text-event-green",
      )}
    >
      <span aria-hidden className="font-medium">
        {glyph}
      </span>
      <span className="sr-only">{sr}</span>
      {label}
    </span>
  );
}

function formatScalar(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}
