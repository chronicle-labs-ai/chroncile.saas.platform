"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Skeleton } from "@/components/ui/skeleton";

interface Run {
  id: string;
  eventId: string;
  invocationId: string;
  workflowId: string | null;
  mode: string;
  status: string;
  eventSnapshot: Record<string, unknown> | null;
  contextPointers: Record<string, unknown> | null;
  agentRequest: Record<string, unknown> | null;
  agentResponse: Record<string, unknown> | null;
  humanDecision: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

interface AuditEntry {
  id: string;
  action: string;
  actor: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

const runFetcher = async (url: string): Promise<Run> => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch run");
  return res.json();
};

const auditFetcher = async (url: string): Promise<{ entries: AuditEntry[] }> => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch audit");
  const data = await res.json();
  return { entries: Array.isArray(data.entries) ? data.entries : [] };
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function statusBadgeClass(status: string): string {
  switch (status?.toLowerCase()) {
    case "completed":
    case "approved":
      return "badge badge--nominal";
    case "rejected":
    case "failed":
      return "badge badge--critical";
    case "pending":
    case "pending_review":
      return "badge badge--caution";
    default:
      return "badge badge--neutral";
  }
}

function statusDisplayLabel(status: string): string {
  if (status === "pending_review") return "Pending review";
  return status;
}

function JsonBlock({ data, title }: { data: unknown; title: string }) {
  if (data == null) return null;
  const str = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-tertiary uppercase tracking-wide">{title}</div>
      <pre className="p-3 rounded border border-border-dim bg-elevated text-xs font-mono text-secondary overflow-x-auto max-h-48 overflow-y-auto">
        {str}
      </pre>
    </div>
  );
}

interface RunDetailClientProps {
  runId: string;
}

export function RunDetailClient({ runId }: RunDetailClientProps) {
  const {
    data: run,
    error: runError,
    isLoading: runLoading,
    mutate: mutateRun,
  } = useSWR<Run>(`/api/runs/${runId}`, runFetcher);

  const { data: auditData, isLoading: auditLoading } = useSWR<{ entries: AuditEntry[] }>(
    run ? `/api/runs/${runId}/audit` : null,
    auditFetcher
  );

  const [updating, setUpdating] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const isReviewable = run != null && run.agentResponse != null && run.humanDecision == null;

  const submitReview = useCallback(
    async (decision: "approved" | "rejected") => {
      if (!run) return;
      setUpdating(true);
      try {
        const res = await fetch(`/api/runs/${runId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: decision === "approved" ? "approved" : "rejected",
            humanDecision: {
              decision,
              reviewedAt: new Date().toISOString(),
              ...(reviewNote.trim() && { note: reviewNote.trim() }),
            },
          }),
        });
        if (!res.ok) throw new Error("Failed to update run");
        setReviewNote("");
        await mutateRun();
      } catch (e) {
        console.error(e);
        alert(e instanceof Error ? e.message : "Failed to update");
      } finally {
        setUpdating(false);
      }
    },
    [run, runId, mutateRun, reviewNote]
  );

  const auditEntries = auditData?.entries ?? [];

  if (runLoading || !run) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/runs" className="text-tertiary hover:text-data transition-colors">
            ← Runs
          </Link>
        </div>
        {runLoading && (
          <div className="panel">
            <div className="p-6 space-y-4">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        )}
        {runError && !runLoading && (
          <div className="panel">
            <div className="p-6 text-center">
              <p className="text-critical mb-2">Run not found</p>
              <Link href="/dashboard/runs" className="text-data hover:underline">
                Back to runs
              </Link>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/runs" className="text-tertiary hover:text-data transition-colors text-sm">
            ← Runs
          </Link>
          <span className="text-border-default">/</span>
          <span className="font-mono text-sm text-secondary truncate max-w-[200px] sm:max-w-none">
            {run.invocationId}
          </span>
        </div>
        <span className={statusBadgeClass(run.status)}>{statusDisplayLabel(run.status)}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="panel">
            <div className="panel__header">
              <span className="panel__title">Run details</span>
              <span className="text-xs text-tertiary">{run.mode}</span>
            </div>
            <div className="panel__content space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-tertiary uppercase tracking-wide mb-1">Event ID</div>
                  <div className="font-mono text-sm text-primary break-all">{run.eventId}</div>
                </div>
                <div>
                  <div className="text-xs text-tertiary uppercase tracking-wide mb-1">Invocation ID</div>
                  <div className="font-mono text-sm text-primary break-all">{run.invocationId}</div>
                </div>
                {run.workflowId && (
                  <div>
                    <div className="text-xs text-tertiary uppercase tracking-wide mb-1">Workflow</div>
                    <div className="text-sm text-primary">{run.workflowId}</div>
                  </div>
                )}
                <div>
                  <div className="text-xs text-tertiary uppercase tracking-wide mb-1">Created</div>
                  <div className="text-sm text-secondary">{formatDate(run.createdAt)}</div>
                </div>
              </div>

              <JsonBlock data={run.eventSnapshot} title="Event snapshot" />
              <JsonBlock data={run.contextPointers} title="Context pointers" />
              <JsonBlock data={run.agentRequest} title="Agent request" />
              <JsonBlock data={run.agentResponse} title="Agent response" />
              <JsonBlock data={run.humanDecision} title="Human decision" />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="panel">
            <div className="panel__header">
              <span className="panel__title">Review</span>
            </div>
            <div className="panel__content">
              {isReviewable ? (
                <>
                  <p className="text-xs text-tertiary mb-3">
                    This run is waiting for human approval or rejection. Your decision is stored for audit and metrics.
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-tertiary tracking-wide uppercase mb-1">
                        Note (optional)
                      </label>
                      <textarea
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                        placeholder="Add a note for this review…"
                        rows={2}
                        className="w-full px-3 py-2 bg-elevated border border-border-default text-sm text-secondary focus:outline-none focus:border-data resize-y"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => submitReview("approved")}
                        disabled={updating}
                        className="btn btn--secondary flex-1"
                      >
                        {updating ? "…" : "Approve"}
                      </button>
                      <button
                        type="button"
                        onClick={() => submitReview("rejected")}
                        disabled={updating}
                        className="btn btn--secondary flex-1"
                      >
                        {updating ? "…" : "Reject"}
                      </button>
                    </div>
                  </div>
                </>
              ) : run?.humanDecision != null ? (
                <p className="text-xs text-tertiary">This run has already been reviewed.</p>
              ) : run?.agentResponse == null ? (
                <p className="text-xs text-tertiary">Waiting for agent response. Use &quot;Send pending to agent&quot; from the Runs list.</p>
              ) : null}
            </div>
          </div>

          <div className="panel">
            <div className="panel__header">
              <span className="panel__title">Audit log</span>
            </div>
            <div className="panel__content">
              {auditLoading && (
                <ul className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <li key={i}>
                      <Skeleton className="h-12 w-full" />
                    </li>
                  ))}
                </ul>
              )}
              {!auditLoading && auditEntries.length === 0 && (
                <p className="text-xs text-tertiary">No audit entries</p>
              )}
              {!auditLoading && auditEntries.length > 0 && (
                <ul className="space-y-2">
                  {auditEntries.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex flex-col gap-1 py-2 border-b border-border-dim last:border-0"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-primary">{entry.action}</span>
                        {entry.actor && (
                          <span className="text-xs text-tertiary">{entry.actor}</span>
                        )}
                        <span className="text-xs font-mono text-tertiary ml-auto">
                          {formatDate(entry.createdAt)}
                        </span>
                      </div>
                      {entry.payload && Object.keys(entry.payload).length > 0 && (
                        <pre className="text-[10px] font-mono text-tertiary overflow-x-auto">
                          {JSON.stringify(entry.payload)}
                        </pre>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
