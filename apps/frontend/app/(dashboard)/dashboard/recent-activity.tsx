"use client";

import Link from "next/link";
import useSWR from "swr";

interface EventEnvelope {
  event_id: string;
  tenant_id?: string;
  source: string;
  source_event_id?: string;
  event_type: string;
  occurred_at: string;
  ingested_at?: string;
  subject?: {
    conversation_id?: string;
    ticket_id?: string;
    customer_id?: string;
  };
  actor?: {
    actor_type?: string;
    actor_id?: string;
    name?: string;
  };
  payload?: Record<string, unknown>;
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  return (
    date.toLocaleTimeString("en-US", { hour12: false }) +
    " " +
    date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  );
}

function getEventIcon(eventType: string) {
  if (eventType.includes("message") || eventType.includes("replied")) {
    return (
      <svg className="w-4 h-4 shrink-0 text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    );
  }
  if (eventType.includes("conversation")) {
    return (
      <svg className="w-4 h-4 shrink-0 text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
      </svg>
    );
  }
  if (eventType.includes("ticket")) {
    return (
      <svg className="w-4 h-4 shrink-0 text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
      </svg>
    );
  }
  if (eventType.includes("user")) {
    return (
      <svg className="w-4 h-4 shrink-0 text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4 shrink-0 text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

const fetcher = async (url: string): Promise<{ events: EventEnvelope[] }> => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch activity");
  const data = await res.json();
  return { events: Array.isArray(data.events) ? data.events : [] };
};

export function RecentActivity() {
  const { data, error, isLoading } = useSWR(
    "/api/dashboard/activity",
    fetcher,
    { revalidateOnFocus: true, refreshInterval: 30000 }
  );

  const events = data?.events ?? [];

  return (
    <div className="panel">
      <div className="panel__header">
        <span className="panel__title">Recent Activity</span>
        <span className="text-xs text-tertiary">Last 24 hours</span>
      </div>
      <div className="panel__content">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="text-sm text-tertiary">Loading...</div>
          </div>
        )}
        {error && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="text-sm text-critical mb-1">Failed to load activity</div>
            <div className="text-xs text-disabled">Try refreshing the page</div>
          </div>
        )}
        {!isLoading && !error && events.length === 0 && (
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
        {!isLoading && !error && events.length > 0 && (
          <ul className="divide-y divide-border-dim">
            {events.map((event) => (
              <li key={event.event_id}>
                <Link
                  href="/dashboard/events"
                  className="flex items-center gap-3 px-4 py-3 hover:bg-hover transition-colors group"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-border-dim bg-elevated text-tertiary">
                    {getEventIcon(event.event_type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-primary truncate">
                        {event.actor?.name || event.actor?.actor_id || "System"}
                      </span>
                      <span className="text-xs text-tertiary truncate">
                        {event.event_type}
                      </span>
                    </div>
                    <div className="text-xs text-tertiary truncate mt-0.5">
                      {event.subject?.conversation_id
                        ? `Conversation ${event.subject.conversation_id.slice(0, 8)}...`
                        : event.source}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-mono text-tertiary tabular-nums">
                    {formatTime(event.occurred_at)}
                  </span>
                  <svg
                    className="w-4 h-4 shrink-0 text-tertiary group-hover:text-data transition-colors"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                  >
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
