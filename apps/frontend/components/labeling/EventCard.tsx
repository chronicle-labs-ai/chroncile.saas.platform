"use client";

import { useState } from "react";
import type { TraceEvent, ActionAnnotation, ActionVerdict } from "@/lib/labeling/types";
import { ACTION_VERDICTS } from "@/lib/labeling/types";

interface EventCardProps {
  event: TraceEvent;
  /** Time offset string like "T+5m" */
  offset: string;
  isFirst?: boolean;
  isLast?: boolean;
  /** AI-generated annotation for this event */
  autoAnnotation?: ActionAnnotation;
  /** Human annotation for this event (editable) */
  annotation?: ActionAnnotation;
  /** Callback when human changes annotation */
  onAnnotationChange?: (annotation: ActionAnnotation) => void;
}

const ACTOR_COLORS: Record<string, { dot: string; text: string; bg: string }> = {
  customer: { dot: "bg-data", text: "text-data", bg: "bg-data-bg" },
  agent: { dot: "bg-nominal", text: "text-nominal", bg: "bg-nominal-bg" },
  system: { dot: "bg-tertiary", text: "text-tertiary", bg: "bg-elevated" },
  manager: { dot: "bg-caution", text: "text-caution", bg: "bg-caution-bg" },
};

const VERDICT_COLORS: Record<ActionVerdict, { badge: string; border: string }> = {
  correct: { badge: "badge--nominal", border: "border-l-[var(--color-nominal)]" },
  partial: { badge: "badge--caution", border: "border-l-[var(--color-caution)]" },
  incorrect: { badge: "badge--critical", border: "border-l-[var(--color-critical)]" },
  unnecessary: { badge: "badge--neutral", border: "border-l-[var(--color-tertiary)]" },
};

/** Whether an event is annotatable (agent, system, or manager — not customer) */
function isAnnotatable(event: TraceEvent): boolean {
  return event.actor.actor_type !== "customer";
}

export function EventCard({
  event,
  offset,
  isFirst,
  isLast,
  autoAnnotation,
  annotation,
  onAnnotationChange,
}: EventCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showAnnotation, setShowAnnotation] = useState(false);
  const colors = ACTOR_COLORS[event.actor.actor_type] ?? ACTOR_COLORS.system;
  const actorLabel = event.actor.actor_type.charAt(0).toUpperCase() + event.actor.actor_type.slice(1);
  const annotatable = isAnnotatable(event);

  // The displayed annotation: human override > auto suggestion
  const displayAnnotation = annotation ?? autoAnnotation;
  const verdictStyle = displayAnnotation ? VERDICT_COLORS[displayAnnotation.verdict] : null;

  const handleVerdictChange = (verdict: ActionVerdict) => {
    if (!onAnnotationChange) return;
    onAnnotationChange({
      event_id: event.event_id,
      verdict,
      should_have_done: annotation?.should_have_done ?? autoAnnotation?.should_have_done ?? "",
      reasoning: annotation?.reasoning ?? autoAnnotation?.reasoning ?? "",
    });
  };

  const handleFieldChange = (field: "should_have_done" | "reasoning", value: string) => {
    if (!onAnnotationChange) return;
    onAnnotationChange({
      event_id: event.event_id,
      verdict: annotation?.verdict ?? autoAnnotation?.verdict ?? "correct",
      should_have_done: annotation?.should_have_done ?? autoAnnotation?.should_have_done ?? "",
      reasoning: annotation?.reasoning ?? autoAnnotation?.reasoning ?? "",
      [field]: value,
    });
  };

  return (
    <div className="relative flex gap-3">
      {/* Timeline line + dot */}
      <div className="flex flex-col items-center w-6 shrink-0">
        {/* Top connector line */}
        <div className={`w-px flex-1 ${isFirst ? "bg-transparent" : "bg-border-default"}`} />
        {/* Dot */}
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${colors.dot} shadow-sm`} />
        {/* Bottom connector line */}
        <div className={`w-px flex-1 ${isLast ? "bg-transparent" : "bg-border-default"}`} />
      </div>

      {/* Content */}
      <div className={`flex-1 pb-4 ${annotatable && verdictStyle ? `pl-2.5 border-l-2 ${verdictStyle.border}` : ""}`}>
        {/* Header: offset + actor + source */}
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-[10px] text-tertiary tabular-nums w-12 shrink-0">
            {offset}
          </span>
          <span className={`font-mono text-[10px] font-medium uppercase tracking-wider ${colors.text}`}>
            {actorLabel}
          </span>
          {event.actor.name && (
            <span className="text-[11px] text-secondary">
              {event.actor.name}
            </span>
          )}
          <span className="font-mono text-[10px] text-disabled ml-auto">
            {event.source}/{event.event_type}
          </span>
        </div>

        {/* Message body */}
        {event.message && (
          <div className={`${colors.bg} border border-border-dim rounded-sm px-3 py-2`}>
            <p className="text-[13px] text-secondary leading-relaxed whitespace-pre-wrap">
              {event.message}
            </p>
          </div>
        )}

        {/* Expandable payload */}
        {event.payload && Object.keys(event.payload).length > 0 && (
          <div className="mt-1.5">
            <button
              onClick={() => setExpanded(!expanded)}
              className="font-mono text-[10px] text-tertiary hover:text-secondary transition-colors"
            >
              {expanded ? "▼ Hide payload" : "▶ Show payload"}
            </button>
            {expanded && (
              <pre className="mt-1 p-2 bg-void border border-border-dim rounded-sm font-mono text-[10px] text-tertiary overflow-x-auto max-h-48 overflow-y-auto">
                {JSON.stringify(event.payload, null, 2)}
              </pre>
            )}
          </div>
        )}

        {/* Annotation controls (only for agent/system/manager events) */}
        {annotatable && displayAnnotation && (
          <div className="mt-2">
            {/* AI verdict badge + toggle */}
            <div className="flex items-center gap-2">
              <span className={`badge ${verdictStyle?.badge} text-[9px]`}>
                {autoAnnotation?.verdict === displayAnnotation.verdict ? "AI: " : ""}
                {ACTION_VERDICTS.find((v) => v.value === displayAnnotation.verdict)?.label ?? displayAnnotation.verdict}
              </span>

              {displayAnnotation.reasoning && !showAnnotation && (
                <span className="text-[11px] text-tertiary truncate max-w-[300px]">
                  {displayAnnotation.reasoning}
                </span>
              )}

              {onAnnotationChange && (
                <button
                  onClick={() => setShowAnnotation(!showAnnotation)}
                  className="font-mono text-[10px] text-tertiary hover:text-secondary transition-colors ml-auto"
                >
                  {showAnnotation ? "▼ Collapse" : "▶ Edit annotation"}
                </button>
              )}
            </div>

            {/* Expanded annotation editor */}
            {showAnnotation && onAnnotationChange && (
              <div className="mt-2 p-3 bg-void border border-border-dim rounded-sm space-y-2.5">
                {/* Verdict selector */}
                <div>
                  <label className="label block mb-1">Verdict</label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {ACTION_VERDICTS.map((v) => (
                      <button
                        key={v.value}
                        onClick={() => handleVerdictChange(v.value as ActionVerdict)}
                        className={`badge text-[10px] cursor-pointer transition-all ${
                          (annotation?.verdict ?? autoAnnotation?.verdict) === v.value
                            ? `badge--${v.color} ring-1 ring-offset-1 ring-offset-void`
                            : "badge--neutral opacity-60 hover:opacity-100"
                        }`}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Should have done */}
                <div>
                  <label className="label block mb-1">What should have been done?</label>
                  <textarea
                    className="input text-[12px] resize-none w-full"
                    rows={2}
                    placeholder={autoAnnotation?.should_have_done || "Describe the ideal action..."}
                    value={annotation?.should_have_done ?? ""}
                    onChange={(e) => handleFieldChange("should_have_done", e.target.value)}
                  />
                </div>

                {/* Reasoning */}
                <div>
                  <label className="label block mb-1">Reasoning</label>
                  <textarea
                    className="input text-[12px] resize-none w-full"
                    rows={2}
                    placeholder={autoAnnotation?.reasoning || "Why this verdict?"}
                    value={annotation?.reasoning ?? ""}
                    onChange={(e) => handleFieldChange("reasoning", e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
