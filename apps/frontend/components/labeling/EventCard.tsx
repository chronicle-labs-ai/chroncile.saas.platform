"use client";

import { useState } from "react";
import type { TraceEvent, ActionAnnotation, ActionVerdict } from "@/lib/labeling/types";
import { ACTION_VERDICTS } from "@/lib/labeling/types";

interface EventCardProps {
  event: TraceEvent;
  offset: string;
  isFirst?: boolean;
  isLast?: boolean;
  autoAnnotation?: ActionAnnotation;
  annotation?: ActionAnnotation;
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

  const displayAnnotation = annotation ?? autoAnnotation;
  const verdictStyle = displayAnnotation ? VERDICT_COLORS[displayAnnotation.verdict] : null;

  const instrViolations = displayAnnotation?.instruction_violations ?? [];
  const ctxViolations = displayAnnotation?.context_violations ?? [];

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
        <div className={`w-px flex-1 ${isFirst ? "bg-transparent" : "bg-border-default"}`} />
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${colors.dot} shadow-sm`} />
        <div className={`w-px flex-1 ${isLast ? "bg-transparent" : "bg-border-default"}`} />
      </div>

      {/* Content */}
      <div className={`flex-1 pb-4 ${annotatable && verdictStyle ? `pl-2.5 border-l-2 ${verdictStyle.border}` : ""}`}>
        {/* Header */}
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

        {/* Annotation controls */}
        {annotatable && displayAnnotation && (
          <div className="mt-2">
            <div className="flex items-center gap-2">
              <span className={`badge ${verdictStyle?.badge} text-[9px]`}>
                {autoAnnotation?.verdict === displayAnnotation.verdict ? "AI: " : ""}
                {ACTION_VERDICTS.find((v) => v.value === displayAnnotation.verdict)?.label ?? displayAnnotation.verdict}
              </span>

              {/* Violation count badges */}
              {instrViolations.length > 0 && (
                <span className="badge badge--critical text-[9px] py-0.5 px-1.5">
                  {instrViolations.length} rule{instrViolations.length > 1 ? "s" : ""} violated
                </span>
              )}
              {ctxViolations.length > 0 && (
                <span className="badge badge--caution text-[9px] py-0.5 px-1.5">
                  {ctxViolations.length} context issue{ctxViolations.length > 1 ? "s" : ""}
                </span>
              )}

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

            {/* Instruction violations (always visible when present) */}
            {instrViolations.length > 0 && !showAnnotation && (
              <div className="mt-1.5 space-y-1">
                {instrViolations.map((iv, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 text-[11px] bg-critical-bg border border-border-dim rounded-sm px-2.5 py-1.5"
                  >
                    <span className="font-mono text-[10px] text-critical font-medium shrink-0">
                      {iv.instruction_id}
                    </span>
                    <div className="flex-1">
                      <p className="text-critical">{iv.violation_description}</p>
                      {iv.context_evidence && (
                        <p className="text-tertiary mt-0.5">Evidence: {iv.context_evidence}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Context violations (always visible when present) */}
            {ctxViolations.length > 0 && !showAnnotation && (
              <div className="mt-1.5 space-y-1">
                {ctxViolations.map((cv, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 text-[11px] border border-border-dim rounded-sm px-2.5 py-1.5 ${
                      cv.severity === "critical" ? "bg-critical-bg" : "bg-caution-bg"
                    }`}
                  >
                    <span className={`font-mono text-[10px] font-medium shrink-0 ${
                      cv.severity === "critical" ? "text-critical" : "text-caution"
                    }`}>
                      {cv.type}
                    </span>
                    <div className="flex-1">
                      <p className={cv.severity === "critical" ? "text-critical" : "text-caution"}>
                        {cv.description}
                      </p>
                      {cv.expected !== undefined && (
                        <p className="text-tertiary mt-0.5">
                          Expected: {JSON.stringify(cv.expected)} — Got: {JSON.stringify(cv.actual)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Expanded annotation editor */}
            {showAnnotation && onAnnotationChange && (
              <div className="mt-2 p-3 bg-void border border-border-dim rounded-sm space-y-2.5">
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

                {/* Instruction violations in editor */}
                {instrViolations.length > 0 && (
                  <div>
                    <label className="label block mb-1">Instruction Violations</label>
                    <div className="space-y-1">
                      {instrViolations.map((iv, i) => (
                        <div key={i} className="bg-critical-bg border border-border-dim rounded-sm px-2.5 py-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] text-critical font-medium">{iv.instruction_id}</span>
                            <span className="text-[10px] text-tertiary italic truncate">{iv.instruction_text}</span>
                          </div>
                          <p className="text-[11px] text-critical mt-0.5">{iv.violation_description}</p>
                          {iv.context_evidence && (
                            <p className="text-[10px] text-tertiary mt-0.5">Evidence: {iv.context_evidence}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Context violations in editor */}
                {ctxViolations.length > 0 && (
                  <div>
                    <label className="label block mb-1">Context Violations</label>
                    <div className="space-y-1">
                      {ctxViolations.map((cv, i) => (
                        <div key={i} className={`border border-border-dim rounded-sm px-2.5 py-1.5 ${
                          cv.severity === "critical" ? "bg-critical-bg" : "bg-caution-bg"
                        }`}>
                          <div className="flex items-center gap-2">
                            <span className={`font-mono text-[10px] font-medium ${
                              cv.severity === "critical" ? "text-critical" : "text-caution"
                            }`}>{cv.type}</span>
                            <span className="text-[10px] text-tertiary">{cv.field}</span>
                          </div>
                          <p className={`text-[11px] mt-0.5 ${
                            cv.severity === "critical" ? "text-critical" : "text-caution"
                          }`}>{cv.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
