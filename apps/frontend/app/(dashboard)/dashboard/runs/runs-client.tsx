"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { Skeleton } from "@/components/ui/skeleton";

interface Run {
  id: string;
  eventId: string;
  invocationId: string;
  workflowId: string | null;
  mode: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface RunsResponse {
  runs: Run[];
  nextCursor: string | null;
  hasMore: boolean;
}

const fetcher = async (url: string): Promise<RunsResponse> => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch runs");
  return res.json();
};

function buildRunsUrl(
  status?: string,
  cursor?: string,
  limit = 20,
  workflowId?: string
): string {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (cursor) params.set("cursor", cursor);
  if (workflowId) params.set("workflowId", workflowId);
  params.set("limit", String(limit));
  return `/api/runs?${params.toString()}`;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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

const WORKFLOW_OPTIONS = [
  { value: "", label: "All" },
  { value: "lead-gen", label: "Lead gen" },
  { value: "demo-workflow", label: "Demo workflow" },
];

export function RunsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const workflowFromUrl = searchParams.get("workflowId") ?? "";

  const [statusFilter, setStatusFilter] = useState<string>("");
  const [workflowFilter, setWorkflowFilter] = useState<string>(() => workflowFromUrl || "");
  const [additionalRuns, setAdditionalRuns] = useState<Run[]>([]);
  const [pageCursor, setPageCursor] = useState<string | null>(null);
  const [pageHasMore, setPageHasMore] = useState(false);

  useEffect(() => {
    setWorkflowFilter(workflowFromUrl || "");
  }, [workflowFromUrl]);

  const effectiveWorkflowId = workflowFilter || undefined;
  const initialUrl = buildRunsUrl(
    statusFilter || undefined,
    undefined,
    20,
    effectiveWorkflowId
  );
  const { data, error, isLoading, mutate } = useSWR<RunsResponse>(initialUrl, fetcher, {
    revalidateOnFocus: true,
  });

  useEffect(() => {
    setAdditionalRuns([]);
    setPageCursor(null);
    setPageHasMore(false);
  }, [statusFilter, workflowFilter]);

  const firstPageRuns = data?.runs ?? [];
  const nextCursor = pageCursor !== null ? pageCursor : (data?.nextCursor ?? null);
  const hasMore = additionalRuns.length > 0 ? pageHasMore : (data?.hasMore ?? false);
  const runs = firstPageRuns.concat(additionalRuns);

  const loadMore = useCallback(async () => {
    const cursorToUse = pageCursor ?? data?.nextCursor;
    if (!cursorToUse || !(data?.hasMore ?? pageHasMore)) return;
    const res = await fetch(
      buildRunsUrl(statusFilter || undefined, cursorToUse, 20, effectiveWorkflowId)
    );
    if (!res.ok) return;
    const next = await res.json() as RunsResponse;
    setAdditionalRuns((prev) => [...prev, ...next.runs]);
    setPageCursor(next.nextCursor);
    setPageHasMore(next.hasMore ?? false);
  }, [data?.nextCursor, data?.hasMore, statusFilter, effectiveWorkflowId, pageCursor, pageHasMore]);

  const [creating, setCreating] = useState(false);
  const [processingPending, setProcessingPending] = useState(false);
  const [processMessage, setProcessMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const sendPendingToAgent = useCallback(async () => {
    setProcessingPending(true);
    setProcessMessage(null);
    try {
      const res = await fetch("/api/runs/process-pending", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to process pending");
      }
      const { processed = 0, failed = 0 } = data;
      if (processed === 0 && failed === 0) {
        setProcessMessage({ type: "success", text: "No pending runs" });
      } else {
        setProcessMessage({
          type: "success",
          text: `${processed} run(s) sent${failed > 0 ? `, ${failed} failed` : ""}`,
        });
      }
      await mutate();
    } catch (e) {
      setProcessMessage({
        type: "error",
        text: e instanceof Error ? e.message : "Failed to send pending to agent",
      });
    } finally {
      setProcessingPending(false);
    }
  }, [mutate]);

  const createTestRun = useCallback(async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: `01${Date.now().toString(36).toUpperCase().padStart(24, "0").slice(-24)}`,
          invocationId: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
          mode: "shadow",
          workflowId: "demo-workflow",
          eventSnapshot: {
            source: "demo",
            event_type: "test.run",
            conversation_id: "conv_demo",
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to create run");
      }
      await mutate();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Failed to create run");
    } finally {
      setCreating(false);
    }
  }, [mutate]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs text-tertiary tracking-wide uppercase mb-1">
            Agent runs
          </div>
          <h1 className="text-2xl font-semibold text-primary">Runs</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {processMessage && (
            <span
              className={`text-sm ${processMessage.type === "success" ? "text-nominal" : "text-critical"}`}
            >
              {processMessage.text}
            </span>
          )}
          <button
            type="button"
            onClick={sendPendingToAgent}
            disabled={processingPending}
            className="btn btn--secondary"
          >
            {processingPending ? "Sending…" : "Send pending to agent"}
          </button>
          <button
            type="button"
            onClick={createTestRun}
            disabled={creating}
            className="btn btn--primary"
          >
            {creating ? "Creating…" : "Create test run"}
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="flex flex-wrap items-center gap-4 px-4 py-3 bg-elevated border-b border-border-dim">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-secondary">Status</span>
            {[
              { value: "", label: "All" },
              { value: "pending", label: "Pending" },
              { value: "pending_review", label: "Needs review" },
              { value: "completed", label: "Completed" },
              { value: "rejected", label: "Rejected" },
              { value: "approved", label: "Approved" },
            ].map(({ value, label }) => (
              <button
                key={value || "all"}
                type="button"
                onClick={() => setStatusFilter(value)}
                className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
                  value === (statusFilter ?? "")
                    ? "bg-data-bg border-data text-data"
                    : "border-border-default text-secondary hover:bg-hover"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="w-px h-6 bg-border-dim" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-secondary">Workflow</span>
            {WORKFLOW_OPTIONS.map(({ value, label }) => (
              <button
                key={value || "all"}
                type="button"
                onClick={() => {
                  setWorkflowFilter(value);
                  const next = new URLSearchParams(searchParams.toString());
                  if (value) next.set("workflowId", value);
                  else next.delete("workflowId");
                  const qs = next.toString();
                  router.replace(qs ? `/dashboard/runs?${qs}` : "/dashboard/runs", { scroll: false });
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
                  value === (workflowFilter ?? "")
                    ? "bg-data-bg border-data text-data"
                    : "border-border-default text-secondary hover:bg-hover"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {isLoading && (
          <ul className="divide-y divide-border-dim">
            {[1, 2, 3, 4, 5].map((i) => (
              <li key={i} className="flex items-center gap-4 px-4 py-4">
                <Skeleton className="h-10 w-10 shrink-0 rounded" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-5 w-20 rounded" />
              </li>
            ))}
          </ul>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-critical mb-1">Failed to load runs</p>
            <p className="text-xs text-tertiary">Try refreshing the page</p>
          </div>
        )}

        {!isLoading && !error && runs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <svg
              className="w-14 h-14 text-border-default mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"
              />
            </svg>
            <p className="text-sm font-medium text-primary mb-1">No runs yet</p>
            <p className="text-xs text-tertiary max-w-sm mb-4">
              Runs are created when events trigger your agent (Queue/Runner + Agent Gateway). Use &quot;Create test run&quot; to add a sample run for demos.
            </p>
            <button
              type="button"
              onClick={createTestRun}
              disabled={creating}
              className="btn btn--primary"
            >
              {creating ? "Creating…" : "Create test run"}
            </button>
          </div>
        )}

        {!isLoading && !error && runs.length > 0 && (
          <>
            <ul className="divide-y divide-border-dim">
              {runs.map((run) => (
                <li key={run.id}>
                  <Link
                    href={`/dashboard/runs/${run.id}`}
                    className="flex items-center gap-4 px-4 py-4 hover:bg-hover transition-colors group"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-border-dim bg-elevated text-tertiary">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm text-primary truncate">
                          {run.invocationId}
                        </span>
                        {run.workflowId && (
                          <span className="text-xs text-tertiary">{run.workflowId}</span>
                        )}
                      </div>
                      <div className="text-xs text-tertiary mt-0.5">
                        event {run.eventId} · {run.mode} · {formatDate(run.createdAt)}
                      </div>
                    </div>
                    <span className={statusBadgeClass(run.status)}>{statusDisplayLabel(run.status)}</span>
                    <svg className="w-4 h-4 shrink-0 text-tertiary group-hover:text-data transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </Link>
                </li>
              ))}
            </ul>
            {hasMore && nextCursor && (
              <div className="px-4 py-3 border-t border-border-dim">
                <button
                  type="button"
                  onClick={loadMore}
                  className="btn btn--secondary w-full sm:w-auto"
                >
                  Load more
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
