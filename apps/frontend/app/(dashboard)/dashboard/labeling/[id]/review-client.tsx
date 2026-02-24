"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Trace, ActionAnnotation, HumanActionAudit, AgentProfile } from "@/lib/labeling/types";
import { getAgentProfile } from "@/lib/labeling/agents";
import { ConfidenceBar } from "@/components/labeling/ConfidenceBar";
import { EventTimeline } from "@/components/labeling/EventTimeline";
import { LabelingPanel } from "@/components/labeling/LabelingPanel";
import { LabelBadge } from "@/components/labeling/LabelBadge";
import { ReviewerRecommendation } from "@/components/labeling/ReviewerRecommendation";

interface ReviewClientProps {
  traceId: string;
  tenantId: string;
}

const STATUS_BADGE: Record<string, { class: string; label: string }> = {
  pending: { class: "badge--neutral", label: "Pending" },
  auto_labeled: { class: "badge--caution", label: "Auto-Labeled" },
  in_review: { class: "badge--data", label: "In Review" },
  labeled: { class: "badge--nominal", label: "Labeled" },
  skipped: { class: "badge--neutral", label: "Skipped" },
};

function formatDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

export function ReviewClient({ traceId }: ReviewClientProps) {
  const router = useRouter();
  const [trace, setTrace] = useState<Trace | null>(null);
  const [prevId, setPrevId] = useState<string | null>(null);
  const [nextId, setNextId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [actionAnnotations, setActionAnnotations] = useState<ActionAnnotation[]>([]);
  const [agentProfileExpanded, setAgentProfileExpanded] = useState(false);
  const [contextExpanded, setContextExpanded] = useState(false);

  const fetchTrace = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/labeling/traces/${traceId}`);
      if (res.ok) {
        const data = await res.json();
        setTrace(data.trace);
        setPrevId(data.prevId);
        setNextId(data.nextId);
        setActionAnnotations(data.trace.humanAudit?.action_annotations ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch trace:", err);
    } finally {
      setLoading(false);
    }
  }, [traceId]);

  useEffect(() => {
    fetchTrace();
  }, [fetchTrace]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === "Enter") {
        // Keyboard save hint
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const handleAnnotationChange = useCallback((annotation: ActionAnnotation) => {
    setActionAnnotations((prev) => {
      const existing = prev.findIndex((a) => a.event_id === annotation.event_id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = annotation;
        return updated;
      }
      return [...prev, annotation];
    });
  }, []);

  const handleSave = async (audit: HumanActionAudit) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/labeling/traces/${traceId}/labels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audit }),
      });
      if (res.ok) {
        showToast("Audit saved");
        if (nextId) {
          router.push(`/dashboard/labeling/${nextId}`);
        } else {
          await fetchTrace();
        }
      }
    } catch (err) {
      console.error("Failed to save audit:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/labeling/traces/${traceId}/skip`, {
        method: "POST",
      });
      if (res.ok) {
        showToast("Trace skipped");
        if (nextId) {
          router.push(`/dashboard/labeling/${nextId}`);
        } else {
          router.push("/dashboard/labeling");
        }
      }
    } catch (err) {
      console.error("Failed to skip:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-4 w-32 bg-hover rounded animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 panel">
            <div className="panel__header">
              <div className="h-4 w-48 bg-hover rounded animate-pulse" />
            </div>
            <div className="p-4 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-6 flex flex-col items-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-hover" />
                  </div>
                  <div className="flex-1">
                    <div className="h-3 w-32 bg-hover rounded animate-pulse mb-2" />
                    <div className="h-12 bg-hover rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-1 panel">
            <div className="panel__header">
              <div className="h-4 w-32 bg-hover rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!trace) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <p className="text-sm text-tertiary mb-4">Trace not found</p>
        <Link href="/dashboard/labeling" className="btn btn--secondary">
          Back to Queue
        </Link>
      </div>
    );
  }

  const statusInfo = STATUS_BADGE[trace.status] ?? STATUS_BADGE.pending;
  const agentProfile = getAgentProfile(trace.agentId);
  const autoAnnotations = trace.autoAudit?.action_annotations ?? [];
  const totalAutoActions = autoAnnotations.length;
  const correctAutoActions = autoAnnotations.filter((a) => a.verdict === "correct").length;
  const ctx = trace.agentContext;

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 badge badge--nominal px-4 py-2 text-sm animate-pulse">
          {toast}
        </div>
      )}

      {/* Back link */}
      <Link
        href="/dashboard/labeling"
        className="inline-flex items-center gap-1.5 text-xs text-tertiary hover:text-secondary transition-colors"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back to Audit Queue
      </Link>

      {/* Trace header */}
      <div className="panel">
        <div className="p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            {agentProfile && (
              <span className="font-mono text-[10px] text-nominal bg-nominal-bg px-1.5 py-0.5 border border-border-dim">
                {agentProfile.name}
              </span>
            )}
            <span className="font-mono text-sm text-primary font-medium">
              {trace.conversationId}
            </span>
            <span className={`badge ${statusInfo.class}`}>
              {statusInfo.label}
            </span>
            {totalAutoActions > 0 && (
              <span
                className={`badge text-[9px] ${
                  correctAutoActions === totalAutoActions
                    ? "badge--nominal"
                    : correctAutoActions >= totalAutoActions * 0.7
                      ? "badge--caution"
                      : "badge--critical"
                }`}
              >
                {correctAutoActions}/{totalAutoActions} correct
              </span>
            )}
            {(trace.autoAudit?.critical_errors?.length ?? 0) > 0 && (
              <span className="badge badge--critical text-[9px]">
                {trace.autoAudit!.critical_errors.length} {trace.autoAudit!.critical_errors.length === 1 ? "error" : "errors"}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
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

            <span className="font-mono text-[11px] text-tertiary tabular-nums">
              {trace.eventCount} events
            </span>

            <span className="font-mono text-[11px] text-tertiary tabular-nums">
              {formatDuration(trace.firstEventAt, trace.lastEventAt)}
            </span>

            <div className="w-32">
              <ConfidenceBar value={trace.confidence} />
            </div>
          </div>
        </div>

        {trace.humanAudit && (
          <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
            <LabelBadge label="Score" value={`${trace.humanAudit.overall_score}/5`} variant="data" />
            {trace.humanAudit.critical_errors.map((err, i) => (
              <LabelBadge key={i} label="Error" value={err} variant="critical" />
            ))}
          </div>
        )}
      </div>

      {/* Agent Profile + Context Snapshot (collapsible) */}
      {agentProfile && (
        <div className="panel">
          <button
            className="panel__header w-full text-left cursor-pointer hover:bg-hover transition-colors"
            onClick={() => setAgentProfileExpanded(!agentProfileExpanded)}
          >
            <span className="panel__title">Agent Profile</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-tertiary">
                {agentProfile.instructions.length} rules · {agentProfile.required_context_fields.length} required fields
              </span>
              <span className="text-tertiary text-[10px]">
                {agentProfileExpanded ? "▼" : "▶"}
              </span>
            </div>
          </button>

          {agentProfileExpanded && (
            <div className="p-4 space-y-4 border-t border-border-dim">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-primary">{agentProfile.name}</span>
                  <span className="font-mono text-[10px] text-tertiary bg-elevated px-1.5 py-0.5 border border-border-dim">
                    {agentProfile.workflow_type}
                  </span>
                </div>
                <p className="text-xs text-tertiary">{agentProfile.description}</p>
              </div>

              <AgentInstructions profile={agentProfile} violatedIds={
                (trace.autoAudit?.instruction_violations_summary ?? []).map((v) => v.instruction_id)
              } />

              <div>
                <span className="font-mono text-[10px] text-tertiary uppercase tracking-wider block mb-1.5">
                  Required Context Fields
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {agentProfile.required_context_fields.map((f) => {
                    const isMissing = ctx.missing_fields.includes(f.field);
                    return (
                      <div
                        key={f.field}
                        className={`flex items-center gap-2 text-[11px] px-2 py-1 rounded-sm border ${
                          isMissing
                            ? "text-critical bg-critical-bg border-border-dim"
                            : "text-secondary bg-surface border-border-dim"
                        }`}
                      >
                        <span className="font-mono font-medium">{f.field}</span>
                        {isMissing && (
                          <span className="badge badge--critical text-[8px] py-0 px-1">MISSING</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Context Snapshot (collapsible) */}
      <div className="panel">
        <button
          className="panel__header w-full text-left cursor-pointer hover:bg-hover transition-colors"
          onClick={() => setContextExpanded(!contextExpanded)}
        >
          <span className="panel__title">Agent Context Snapshot</span>
          <div className="flex items-center gap-2">
            {ctx.missing_fields.length > 0 && (
              <span className="badge badge--critical text-[9px] py-0.5 px-1.5">
                {ctx.missing_fields.length} missing
              </span>
            )}
            {ctx.stale_fields.length > 0 && (
              <span className="badge badge--caution text-[9px] py-0.5 px-1.5">
                {ctx.stale_fields.length} stale
              </span>
            )}
            {ctx.missing_fields.length === 0 && ctx.stale_fields.length === 0 && (
              <span className="badge badge--nominal text-[9px] py-0.5 px-1.5">
                Clean
              </span>
            )}
            <span className="text-tertiary text-[10px]">
              {contextExpanded ? "▼" : "▶"}
            </span>
          </div>
        </button>

        {contextExpanded && (
          <div className="p-4 border-t border-border-dim">
            <div className="space-y-1">
              {Object.entries(ctx.fields).map(([key, value]) => {
                const staleEntry = ctx.stale_fields.find((s) => s.field === key);
                const isStale = !!staleEntry;

                return (
                  <div
                    key={key}
                    className={`flex items-start gap-3 text-[11px] px-2.5 py-1.5 rounded-sm border ${
                      isStale
                        ? "bg-caution-bg border-border-dim"
                        : "bg-surface border-border-dim"
                    }`}
                  >
                    <span className="font-mono font-medium text-secondary w-32 shrink-0">{key}</span>
                    <span className="font-mono text-tertiary flex-1 break-all">
                      {typeof value === "object" ? JSON.stringify(value) : String(value)}
                    </span>
                    {isStale && (
                      <div className="shrink-0 text-right">
                        <span className="badge badge--caution text-[8px] py-0 px-1">STALE</span>
                        <p className="text-[9px] text-caution mt-0.5">
                          Correct: {typeof staleEntry.correct_value === "object"
                            ? JSON.stringify(staleEntry.correct_value)
                            : String(staleEntry.correct_value)}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}

              {ctx.missing_fields.map((field) => (
                <div
                  key={field}
                  className="flex items-center gap-3 text-[11px] px-2.5 py-1.5 rounded-sm border bg-critical-bg border-border-dim"
                >
                  <span className="font-mono font-medium text-critical w-32 shrink-0">{field}</span>
                  <span className="text-critical italic">Not present in agent context</span>
                  <span className="badge badge--critical text-[8px] py-0 px-1 ml-auto">MISSING</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main content: timeline + labeling panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="panel">
            <div className="panel__header">
              <span className="panel__title">Event Timeline</span>
              <span className="font-mono text-[10px] text-tertiary tabular-nums">
                {new Date(trace.firstEventAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <div className="panel__content max-h-[calc(100vh-420px)] overflow-y-auto">
              <EventTimeline
                events={trace.events}
                autoAnnotations={trace.autoAudit?.action_annotations}
                annotations={actionAnnotations}
                onAnnotationChange={handleAnnotationChange}
              />
            </div>
          </div>

          <div className="panel">
            <ReviewerRecommendation
              trace={trace}
              onNotificationSent={(name, channel) =>
                showToast(`${channel === "slack" ? "Slack" : "Email"} sent to ${name}`)
              }
            />
          </div>
        </div>

        <div className="lg:col-span-1 panel flex flex-col max-h-[calc(100vh-260px)] overflow-hidden">
          <LabelingPanel
            trace={trace}
            actionAnnotations={actionAnnotations}
            onSave={handleSave}
            onSkip={handleSkip}
            onPrev={prevId ? () => router.push(`/dashboard/labeling/${prevId}`) : undefined}
            onNext={nextId ? () => router.push(`/dashboard/labeling/${nextId}`) : undefined}
            hasPrev={!!prevId}
            hasNext={!!nextId}
            saving={saving}
          />
        </div>
      </div>
    </div>
  );
}

function AgentInstructions({
  profile,
  violatedIds,
}: {
  profile: AgentProfile;
  violatedIds: string[];
}) {
  return (
    <div>
      <span className="font-mono text-[10px] text-tertiary uppercase tracking-wider block mb-1.5">
        Instructions (SOP)
      </span>
      <div className="space-y-1">
        {profile.instructions.map((rule) => {
          const isViolated = violatedIds.includes(rule.id);
          return (
            <div
              key={rule.id}
              className={`flex items-start gap-2 text-[11px] px-2.5 py-1.5 rounded-sm border ${
                isViolated
                  ? "bg-critical-bg border-border-dim"
                  : "bg-surface border-border-dim"
              }`}
            >
              <span className={`font-mono font-medium shrink-0 ${
                isViolated ? "text-critical" : "text-tertiary"
              }`}>
                {rule.id}
              </span>
              <span className={isViolated ? "text-critical" : "text-secondary"}>
                {rule.text}
              </span>
              <span className="font-mono text-[9px] text-disabled ml-auto shrink-0">
                {rule.category}
              </span>
              {isViolated && (
                <span className="badge badge--critical text-[8px] py-0 px-1 shrink-0">VIOLATED</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
