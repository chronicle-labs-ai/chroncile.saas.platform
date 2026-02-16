"use client";

import { useState, useEffect } from "react";
import type { Trace, HumanActionAudit, ActionAnnotation } from "@/lib/labeling/types";
import { ConfidenceBar } from "./ConfidenceBar";
import { StarRating } from "./StarRating";

interface LabelingPanelProps {
  trace: Trace;
  /** Current per-action annotations from the timeline */
  actionAnnotations: ActionAnnotation[];
  onSave: (audit: HumanActionAudit) => void;
  onSkip: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  saving?: boolean;
}

export function LabelingPanel({
  trace,
  actionAnnotations,
  onSave,
  onSkip,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  saving,
}: LabelingPanelProps) {
  const auto = trace.autoAudit;

  // Initialize from human audit (if editing) or auto audit (if new)
  const existingAudit = trace.humanAudit;
  const [overallScore, setOverallScore] = useState(
    existingAudit?.overall_score ?? auto?.overall_score ?? 3
  );
  const [criticalErrors, setCriticalErrors] = useState<string[]>(
    existingAudit?.critical_errors ?? auto?.critical_errors ?? []
  );
  const [correctionSummary, setCorrectionSummary] = useState(
    existingAudit?.correction_summary ?? auto?.correction_summary ?? ""
  );
  const [notes, setNotes] = useState(existingAudit?.notes ?? "");
  const [newError, setNewError] = useState("");

  // Reset when trace changes
  useEffect(() => {
    const ea = trace.humanAudit;
    const aa = trace.autoAudit;
    setOverallScore(ea?.overall_score ?? aa?.overall_score ?? 3);
    setCriticalErrors(ea?.critical_errors ?? aa?.critical_errors ?? []);
    setCorrectionSummary(ea?.correction_summary ?? aa?.correction_summary ?? "");
    setNotes(ea?.notes ?? "");
    setNewError("");
  }, [trace.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const addError = () => {
    const trimmed = newError.trim();
    if (trimmed && !criticalErrors.includes(trimmed)) {
      setCriticalErrors((prev) => [...prev, trimmed]);
      setNewError("");
    }
  };

  const removeError = (idx: number) => {
    setCriticalErrors((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    onSave({
      action_annotations: actionAnnotations,
      overall_score: overallScore,
      critical_errors: criticalErrors,
      correction_summary: correctionSummary,
      notes,
    });
  };

  // Count annotation stats
  const annotationCount = actionAnnotations.length;
  const autoAnnotationCount = auto?.action_annotations?.length ?? 0;

  return (
    <div className="flex flex-col h-full">
      {/* AI Suggestions (read-only) */}
      {auto && (
        <div className="border-b border-border-dim">
          <div className="panel__header">
            <span className="panel__title">AI Audit Suggestions</span>
            <span className="font-mono text-[10px] text-tertiary">
              Confidence: {trace.confidence?.toFixed(2)}
            </span>
          </div>
          <div className="p-4 space-y-3 bg-surface">
            {/* Overall score */}
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] text-tertiary uppercase tracking-wider w-28 shrink-0">
                Overall Score
              </span>
              <StarRating value={auto.overall_score} onChange={() => {}} />
              <div className="w-16 shrink-0">
                <ConfidenceBar value={auto.confidence} size="sm" showValue={false} />
              </div>
            </div>

            {/* Action annotations count */}
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] text-tertiary uppercase tracking-wider w-28 shrink-0">
                Actions Audited
              </span>
              <span className="text-xs text-secondary">
                {autoAnnotationCount} actions annotated
              </span>
            </div>

            {/* Critical errors */}
            {auto.critical_errors.length > 0 && (
              <div>
                <span className="font-mono text-[10px] text-tertiary uppercase tracking-wider block mb-1.5">
                  Critical Errors
                </span>
                <div className="space-y-1">
                  {auto.critical_errors.map((err, i) => (
                    <div
                      key={i}
                      className="text-[11px] text-critical bg-critical-bg border border-border-dim rounded-sm px-2 py-1"
                    >
                      {err}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Correction summary */}
            {auto.correction_summary && (
              <div>
                <span className="font-mono text-[10px] text-tertiary uppercase tracking-wider block mb-1">
                  Correction Summary
                </span>
                <p className="text-[11px] text-tertiary leading-relaxed">
                  {auto.correction_summary}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Human audit form */}
      <div className="flex-1 overflow-y-auto">
        <div className="panel__header">
          <span className="panel__title">Human Audit</span>
          {annotationCount > 0 && (
            <span className="font-mono text-[10px] text-tertiary">
              {annotationCount} actions annotated
            </span>
          )}
        </div>
        <div className="p-4 space-y-4">
          {/* Overall Agent Score */}
          <FormField label="Overall Agent Score">
            <StarRating
              value={overallScore}
              onChange={setOverallScore}
            />
          </FormField>

          {/* Critical Errors (editable tag list) */}
          <FormField label="Critical Errors">
            <div className="space-y-1.5">
              {criticalErrors.map((err, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-[12px] text-critical bg-critical-bg border border-border-dim rounded-sm px-2.5 py-1.5"
                >
                  <span className="flex-1">{err}</span>
                  <button
                    onClick={() => removeError(i)}
                    className="text-critical/50 hover:text-critical shrink-0 mt-0.5"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  className="input text-[12px] flex-1"
                  placeholder="Add a critical error..."
                  value={newError}
                  onChange={(e) => setNewError(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addError();
                    }
                  }}
                />
                <button
                  className="btn btn--ghost btn--sm text-[10px]"
                  onClick={addError}
                  disabled={!newError.trim()}
                >
                  Add
                </button>
              </div>
            </div>
          </FormField>

          {/* Correction Summary */}
          <FormField label="Correction Summary">
            <textarea
              className="input text-sm resize-none"
              rows={3}
              placeholder="What should the agent have done differently overall?"
              value={correctionSummary}
              onChange={(e) => setCorrectionSummary(e.target.value)}
            />
          </FormField>

          {/* Notes */}
          <FormField label="Reviewer Notes">
            <textarea
              className="input text-sm resize-none"
              rows={2}
              placeholder="Additional notes or observations..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </FormField>
        </div>
      </div>

      {/* Action bar */}
      <div className="border-t border-border-dim p-4 space-y-3 bg-elevated">
        <div className="flex items-center gap-2">
          <button
            className="btn btn--primary flex-1"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Audit"}
          </button>
          <button
            className="btn btn--ghost"
            onClick={onSkip}
            disabled={saving}
          >
            Skip
          </button>
        </div>

        <div className="flex items-center justify-between">
          <button
            className="btn btn--ghost btn--sm"
            onClick={onPrev}
            disabled={!hasPrev || saving}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Prev
          </button>
          <span className="font-mono text-[10px] text-disabled">
            &#x2318;+Enter to save
          </span>
          <button
            className="btn btn--ghost btn--sm"
            onClick={onNext}
            disabled={!hasNext || saving}
          >
            Next
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label block mb-1.5">{label}</label>
      {children}
    </div>
  );
}
