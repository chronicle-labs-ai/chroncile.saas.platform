"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Trace, ActionAnnotation, HumanActionAudit } from "@/lib/labeling/types";
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

  // Per-action annotation state (human overrides)
  const [actionAnnotations, setActionAnnotations] = useState<ActionAnnotation[]>([]);

  const fetchTrace = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/labeling/traces/${traceId}`);
      if (res.ok) {
        const data = await res.json();
        setTrace(data.trace);
        setPrevId(data.prevId);
        setNextId(data.nextId);
        // Initialize action annotations from existing human audit or empty
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

  // Keyboard shortcut: Cmd+Enter to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === "Enter") {
        // Trigger save via form submit would be complex; this is a hint
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  /** Handle per-action annotation changes from EventCard */
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

  /** Save the full audit (per-action annotations + trace-level audit) */
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
        // Auto-advance to next trace
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

  // Audit stats for header
  const autoAnnotations = trace.autoAudit?.action_annotations ?? [];
  const totalAutoActions = autoAnnotations.length;
  const correctAutoActions = autoAnnotations.filter((a) => a.verdict === "correct").length;

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
            <span className="font-mono text-sm text-primary font-medium">
              {trace.conversationId}
            </span>
            <span className={`badge ${statusInfo.class}`}>
              {statusInfo.label}
            </span>
            {/* Action audit summary badges */}
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

        {/* Existing human audit badges (if labeled) */}
        {trace.humanAudit && (
          <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
            <LabelBadge label="Score" value={`${trace.humanAudit.overall_score}/5`} variant="data" />
            {trace.humanAudit.critical_errors.map((err, i) => (
              <LabelBadge key={i} label="Error" value={err} variant="critical" />
            ))}
          </div>
        )}
      </div>

      {/* Main content: timeline + labeling panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left column: Event timeline + Reviewer recommendation */}
        <div className="lg:col-span-2 space-y-4">
          {/* Event timeline */}
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

          {/* Reviewer recommendation */}
          <div className="panel">
            <ReviewerRecommendation
              trace={trace}
              onNotificationSent={(name, channel) =>
                showToast(`${channel === "slack" ? "Slack" : "Email"} sent to ${name}`)
              }
            />
          </div>
        </div>

        {/* Right column: Labeling panel */}
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
