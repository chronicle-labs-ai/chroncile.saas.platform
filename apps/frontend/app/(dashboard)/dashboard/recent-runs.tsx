"use client";

import Link from "next/link";
import useSWR from "swr";

interface Run {
  id: string;
  invocationId: string;
  status: string;
  mode: string;
  createdAt: string;
}

const fetcher = async (url: string): Promise<{ runs: Run[] }> => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return { runs: [] };
  const data = await res.json();
  return { runs: Array.isArray(data.runs) ? data.runs : [] };
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusClass(status: string): string {
  switch (status?.toLowerCase()) {
    case "completed":
    case "approved":
      return "text-nominal";
    case "rejected":
    case "failed":
      return "text-critical";
    case "pending":
    case "pending_review":
      return "text-caution";
    default:
      return "text-tertiary";
  }
}

function statusDisplayLabel(status: string): string {
  if (status === "pending_review") return "Pending review";
  return status;
}

export function RecentRuns() {
  const { data } = useSWR("/api/runs?limit=5", fetcher, {
    revalidateOnFocus: true,
    refreshInterval: 15000,
  });
  const runs = data?.runs ?? [];

  return (
    <div className="panel">
      <div className="panel__header">
        <span className="panel__title">Recent runs</span>
        <Link href="/dashboard/runs" className="text-xs text-data hover:underline">
          View all
        </Link>
      </div>
      <div className="panel__content">
        {runs.length === 0 ? (
          <p className="text-xs text-tertiary">No runs yet. Create a test run from the Runs page.</p>
        ) : (
          <ul className="space-y-1">
            {runs.map((run) => (
              <li key={run.id}>
                <Link
                  href={`/dashboard/runs/${run.id}`}
                  className="flex items-center justify-between gap-2 py-2 hover:bg-hover -mx-2 px-2 rounded transition-colors group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-xs text-secondary truncate">
                      {run.invocationId}
                    </div>
                    <div className="text-[10px] text-tertiary mt-0.5">
                      {formatDate(run.createdAt)}
                    </div>
                  </div>
                  <span className={`text-xs shrink-0 ${statusClass(run.status)}`}>
                    {statusDisplayLabel(run.status)}
                  </span>
                  <svg className="w-3.5 h-3.5 shrink-0 text-tertiary group-hover:text-data transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
