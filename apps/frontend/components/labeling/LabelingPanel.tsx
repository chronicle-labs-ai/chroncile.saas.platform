"use client";

import { useState } from "react";
import type {
  Trace,
  HumanActionAudit,
  ActionAnnotation,
} from "@/lib/labeling/types";
import { ConfidenceBar } from "./ConfidenceBar";
import { StarRating } from "./StarRating";

interface LabelingPanelProps {
  trace: Trace;
  actionAnnotations: ActionAnnotation[];
  onSave: (audit: HumanActionAudit) => void;
  onSkip: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  saving?: boolean;
}

function getInitialAuditValues(trace: Trace) {
  const existingAudit = trace.humanAudit;
  const auto = trace.autoAudit;

  return {
    correctionSummary:
      existingAudit?.correction_summary ?? auto?.correction_summary ?? "",
    criticalErrors:
      existingAudit?.critical_errors ?? auto?.critical_errors ?? [],
    notes: existingAudit?.notes ?? "",
    overallScore: existingAudit?.overall_score ?? auto?.overall_score ?? 3,
  };
}

export function LabelingPanel(props: LabelingPanelProps) {
  return <LabelingPanelForm key={props.trace.id} {...props} />;
}

function LabelingPanelForm({
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
  const initialAuditValues = getInitialAuditValues(trace);
  const [overallScore, setOverallScore] = useState(
    initialAuditValues.overallScore
  );
  const [criticalErrors, setCriticalErrors] = useState<string[]>(
    initialAuditValues.criticalErrors
  );
  const [correctionSummary, setCorrectionSummary] = useState(
    initialAuditValues.correctionSummary
  );
  const [notes, setNotes] = useState(initialAuditValues.notes);
  const [newError, setNewError] = useState("");

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

  const annotationCount = actionAnnotations.length;
  const autoAnnotationCount = auto?.action_annotations?.length ?? 0;

  const ood = auto?.ood_score;
  const ctxIntegrity = auto?.context_integrity;
  const instrViolations = auto?.instruction_violations_summary ?? [];

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
                <ConfidenceBar
                  value={auto.confidence}
                  size="sm"
                  showValue={false}
                />
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

            {/* OOD Detection */}
            {ood && (
              <div>
                <span className="font-mono text-[10px] text-tertiary uppercase tracking-wider block mb-1.5">
                  OOD Detection
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <OODBar label="Transition" value={ood.transition_deviation} />
                  <OODBar
                    label="Tool Freq"
                    value={ood.tool_frequency_deviation}
                  />
                  <OODBar label="Temporal" value={ood.temporal_deviation} />
                  <OODBar label="Embedding" value={ood.embedding_distance} />
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="font-mono text-[10px] text-tertiary">
                    Composite: {ood.composite_score.toFixed(2)}
                  </span>
                  {ood.flagged && (
                    <span className="badge badge--caution text-[9px] py-0.5 px-1.5">
                      FLAGGED
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Context Integrity */}
            {ctxIntegrity && (
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-mono text-[10px] text-tertiary uppercase tracking-wider">
                    Context Integrity
                  </span>
                  <span
                    className={`badge text-[9px] py-0.5 px-1.5 ${
                      ctxIntegrity.passed ? "badge--nominal" : "badge--critical"
                    }`}
                  >
                    {ctxIntegrity.passed ? "PASSED" : "FAILED"}
                  </span>
                </div>
                {ctxIntegrity.violations.length > 0 && (
                  <div className="space-y-1">
                    {ctxIntegrity.violations.map((v, i) => (
                      <div
                        key={i}
                        className={`text-[11px] border border-border-dim rounded-sm px-2 py-1 ${
                          v.severity === "critical"
                            ? "text-critical bg-critical-bg"
                            : "text-caution bg-caution-bg"
                        }`}
                      >
                        <span className="font-mono text-[10px] font-medium">
                          {v.type}
                        </span>
                        <span className="text-tertiary mx-1">·</span>
                        <span className="font-mono text-[10px]">{v.field}</span>
                        <span className="text-tertiary mx-1">—</span>
                        {v.description}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Instruction Violations */}
            {instrViolations.length > 0 && (
              <div>
                <span className="font-mono text-[10px] text-tertiary uppercase tracking-wider block mb-1.5">
                  Instruction Violations ({instrViolations.length})
                </span>
                <div className="space-y-1">
                  {instrViolations.map((iv, i) => (
                    <div
                      key={i}
                      className="text-[11px] text-critical bg-critical-bg border border-border-dim rounded-sm px-2 py-1"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] font-medium">
                          {iv.instruction_id}
                        </span>
                        <span className="text-tertiary italic truncate text-[10px]">
                          {iv.instruction_text}
                        </span>
                      </div>
                      <p className="mt-0.5">{iv.violation_description}</p>
                      {iv.context_evidence && (
                        <p className="text-tertiary mt-0.5 text-[10px]">
                          Evidence: {iv.context_evidence}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

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
          <FormField label="Overall Agent Score">
            <StarRating value={overallScore} onChange={setOverallScore} />
          </FormField>

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
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
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

          <FormField label="Correction Summary">
            <textarea
              className="input text-sm resize-none"
              rows={3}
              placeholder="What should the agent have done differently overall?"
              value={correctionSummary}
              onChange={(e) => setCorrectionSummary(e.target.value)}
            />
          </FormField>

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
          <button className="btn btn--ghost" onClick={onSkip} disabled={saving}>
            Skip
          </button>
        </div>

        <div className="flex items-center justify-between">
          <button
            className="btn btn--ghost btn--sm"
            onClick={onPrev}
            disabled={!hasPrev || saving}
          >
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 19.5L8.25 12l7.5-7.5"
              />
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
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.25 4.5l7.5 7.5-7.5 7.5"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

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

function OODBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  const color =
    value >= 0.7 ? "bg-critical" : value >= 0.4 ? "bg-caution" : "bg-nominal";

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[9px] text-tertiary w-14 shrink-0 text-right">
        {label}
      </span>
      <div className="flex-1 h-1.5 bg-elevated rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-[9px] text-tertiary w-7 tabular-nums">
        {pct}%
      </span>
    </div>
  );
}
