"use client";

import type { TraceSummary } from "@/lib/labeling/types";
import { ConfidenceBar } from "./ConfidenceBar";

interface TraceRowProps {
  trace: TraceSummary;
  onClick?: () => void;
}

const STATUS_DOT: Record<string, string> = {
  pending: "status-dot--offline",
  auto_labeled: "status-dot--caution",
  in_review: "status-dot--data",
  labeled: "status-dot--nominal",
  skipped: "status-dot--offline",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  auto_labeled: "Auto-Labeled",
  in_review: "In Review",
  labeled: "Labeled",
  skipped: "Skipped",
};

function formatDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

export function TraceRow({ trace, onClick }: TraceRowProps) {
  const duration = formatDuration(trace.firstEventAt, trace.lastEventAt);
  const summary = trace.autoAudit?.summary ?? "";

  // Action audit stats
  const annotations = trace.autoAudit?.action_annotations ?? [];
  const totalActions = annotations.length;
  const correctActions = annotations.filter(
    (a) => a.verdict === "correct"
  ).length;
  const errorCount = trace.autoAudit?.critical_errors?.length ?? 0;

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3.5 border-b border-border-dim
        hover:bg-hover transition-colors duration-fast group"
    >
      {/* Row 1: status, conversation ID, action audit badge, confidence */}
      <div className="flex items-center gap-3 mb-1.5">
        <div className={`status-dot ${STATUS_DOT[trace.status]}`} />

        <span className="font-mono text-xs text-secondary truncate max-w-[160px]">
          {trace.conversationId}
        </span>

        {/* Action correctness count */}
        {totalActions > 0 && (
          <span
            className={`badge text-[9px] py-0.5 px-1.5 ${
              correctActions === totalActions
                ? "badge--nominal"
                : correctActions >= totalActions * 0.7
                  ? "badge--caution"
                  : "badge--critical"
            }`}
          >
            {correctActions}/{totalActions} correct
          </span>
        )}

        {/* Critical error count */}
        {errorCount > 0 && (
          <span className="badge badge--critical text-[9px] py-0.5 px-1.5">
            {errorCount} {errorCount === 1 ? "error" : "errors"}
          </span>
        )}

        <span className="font-mono text-[10px] text-tertiary ml-auto hidden sm:inline">
          {STATUS_LABEL[trace.status]}
        </span>

        <div className="w-28 hidden md:block">
          <ConfidenceBar value={trace.confidence} size="sm" />
        </div>
      </div>

      {/* Row 2: sources, event count, duration */}
      <div className="flex items-center gap-3 ml-[18px]">
        <div className="flex items-center gap-1.5">
          {trace.sources.map((s) => (
            <span
              key={s}
              className="font-mono text-[10px] text-tertiary bg-elevated px-1.5 py-0.5 border border-border-dim"
            >
              {s}
            </span>
          ))}
        </div>

        <span className="text-[10px] text-disabled">|</span>

        <span className="font-mono text-[10px] text-tertiary tabular-nums">
          {trace.eventCount} events
        </span>

        <span className="text-[10px] text-disabled">|</span>

        <span className="font-mono text-[10px] text-tertiary tabular-nums">
          {duration}
        </span>
      </div>

      {/* Row 3: summary excerpt */}
      {summary && (
        <p className="mt-1.5 ml-[18px] text-xs text-tertiary line-clamp-1 group-hover:text-secondary transition-colors">
          &ldquo;{summary}&rdquo;
        </p>
      )}
    </button>
  );
}
