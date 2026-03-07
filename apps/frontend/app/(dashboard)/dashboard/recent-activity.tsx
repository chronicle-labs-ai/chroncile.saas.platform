"use client";

import Link from "next/link";
import { Skeleton } from "ui";
import { useApiSwr } from "@/shared/hooks/use-api-swr";
import type { AuditLog, DashboardActivityResponse } from "shared/generated";

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  return (
    date.toLocaleTimeString("en-US", { hour12: false }) +
    " " +
    date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  );
}

function getActionIcon(action: string) {
  if (action.includes("run")) {
    return (
      <svg className="w-4 h-4 shrink-0 text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
      </svg>
    );
  }
  if (action.includes("connection")) {
    return (
      <svg className="w-4 h-4 shrink-0 text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4 shrink-0 text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

export function RecentActivity() {
  const { data, error, isLoading } = useApiSwr<DashboardActivityResponse>(
    "/api/platform/dashboard/activity",
    { revalidateOnFocus: true, refreshInterval: 30000 },
  );

  const entries: AuditLog[] = data?.activity ?? [];

  return (
    <div className="panel">
      <div className="panel__header">
        <span className="panel__title">Recent Activity</span>
        <span className="text-xs text-tertiary">Last 24 hours</span>
      </div>
      <div className="panel__content">
        {isLoading && (
          <ul className="divide-y divide-border-dim">
            {[1, 2, 3, 4, 5].map((i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-9 w-9 shrink-0 rounded" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-3 w-16 shrink-0" />
              </li>
            ))}
          </ul>
        )}
        {error && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="text-sm text-critical mb-1">Failed to load activity</div>
            <div className="text-xs text-disabled">Try refreshing the page</div>
          </div>
        )}
        {!isLoading && !error && entries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <svg
              className="w-12 h-12 text-border-default mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"
              />
            </svg>
            <div className="text-sm text-tertiary mb-1">No activity recorded</div>
            <div className="text-xs text-disabled">
              Connect an integration to begin capturing events
            </div>
          </div>
        )}
        {!isLoading && !error && entries.length > 0 && (
          <ul className="divide-y divide-border-dim">
            {entries.map((entry) => (
              <li key={entry.id}>
                <Link
                  href="/dashboard/runs"
                  className="flex items-center gap-3 px-4 py-3 hover:bg-hover transition-colors group"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-border-dim bg-elevated text-tertiary">
                    {getActionIcon(entry.action)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-primary truncate">
                        {entry.actor || "System"}
                      </span>
                      <span className="text-xs text-tertiary truncate">
                        {entry.action}
                      </span>
                    </div>
                    {entry.runId && (
                      <div className="text-xs text-tertiary truncate mt-0.5">
                        Run {entry.runId.slice(0, 8)}...
                      </div>
                    )}
                  </div>
                  <span className="shrink-0 text-xs font-mono text-tertiary tabular-nums">
                    {formatTime(entry.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
