"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { subscribeToStream } from "@/lib/events-manager-sse";
import { eventEnvelopeToTimelineEvent } from "@/components/timeline/mapEvent";
import type { TimelineEvent } from "@/components/timeline/types";
import { TimelinePanel } from "@/components/timeline/TimelinePanel";
import { EventDetailPanel } from "@/components/timeline/EventDetailPanel";
import { StreamsPanel } from "@/components/streams-panel/StreamsPanel";
import type { RecordingState } from "@/components/streams-panel/types";
import { REC_IDLE, recRecording } from "@/components/streams-panel/types";
import { Skeleton } from "@/components/ui/skeleton";

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

const getActorType = (event: EventEnvelope): string => {
  return event.actor?.actor_type || "system";
};

const getActorDisplay = (event: EventEnvelope): string => {
  return event.actor?.name || event.actor?.actor_id || "Unknown";
};

const getConversationId = (event: EventEnvelope): string => {
  return event.subject?.conversation_id || "N/A";
};

const MESSENGER_STORAGE_KEY = "chronicle-labs-events-messenger";

interface StoredMessenger {
  provider: string;
  appId: string;
}

interface EventsClientProps {
  tenantId: string;
  eventsManagerUrl: string;
  hasActiveIntercom: boolean;
}

function EventsListSkeleton({ tabBar }: { tabBar: React.ReactNode }) {
  return (
    <div className="space-y-6">
      {tabBar}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-3 w-28 mb-1" />
          <Skeleton className="h-7 w-24" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
      <div className="panel">
        <div className="flex items-center justify-between px-4 py-3 bg-elevated border-b border-border-dim">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 panel">
          <div className="panel__header">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-14 rounded-sm" />
          </div>
          <div className="divide-y divide-border-dim max-h-[600px] overflow-y-auto">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="w-8 h-8 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-4 w-14 rounded-sm" />
                  </div>
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-4 w-4 shrink-0 rounded" />
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <div className="panel__header">
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="panel__content space-y-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function EventsClient({ tenantId, eventsManagerUrl, hasActiveIntercom }: EventsClientProps) {
  const [viewTab, setViewTab] = useState<"list" | "timeline">("list");

  const [events, setEvents] = useState<EventEnvelope[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventEnvelope | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const [timelineBuffer, setTimelineBuffer] = useState<TimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);
  const [timelinePlayback, setTimelinePlayback] = useState<"live" | "playing" | "paused">("paused");
  const [selectedTimelineEventId, setSelectedTimelineEventId] = useState<string | null>(null);
  const [recordingState, setRecordingState] = useState<RecordingState>(REC_IDLE);
  const recordingStateRef = useRef<RecordingState>(REC_IDLE);
  recordingStateRef.current = recordingState;
  const recordingBufferRef = useRef<TimelineEvent[]>([]);
  const [timelineFilter, setTimelineFilter] = useState<string>("all");
  const [newEventsCount, setNewEventsCount] = useState(0);

  const [messengerPanelOpen, setMessengerPanelOpen] = useState(false);
  const [messengerStep, setMessengerStep] = useState<"provider" | "appId">("provider");
  const [messengerProvider, setMessengerProvider] = useState<string | null>(null);
  const [messengerAppId, setMessengerAppId] = useState("");
  const [messengerStatus, setMessengerStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [messengerError, setMessengerError] = useState("");
  const messengerScriptRef = useRef<HTMLScriptElement | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      params.set("limit", "100");
      params.set("tenant_id", tenantId);
      if (filter !== "all") {
        params.set("source", filter);
      }
      
      const response = await fetch(`${eventsManagerUrl}/api/events/query?${params}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch events: ${response.status}`);
      }
      
      const data = await response.json();
      setEvents(data.events || []);
    } catch (err) {
      console.error("Error fetching events:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch events");
    } finally {
      setLoading(false);
    }
  }, [eventsManagerUrl, filter, tenantId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    if (viewTab !== "timeline") return;
    let closed = false;
    setTimelineLoading(true);
    const params = new URLSearchParams();
    params.set("limit", "100");
    params.set("tenant_id", tenantId);
    if (timelineFilter !== "all") params.set("source", timelineFilter);
    fetch(`${eventsManagerUrl}/api/events/query?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (closed) return;
        const list = (data.events || []) as Array<{
          event_id: string;
          source: string;
          source_event_id?: string;
          event_type: string;
          conversation_id?: string;
          actor_type?: string;
          actor_id?: string;
          actor_name?: string | null;
          occurred_at: string;
          ingested_at?: string;
          payload?: Record<string, unknown>;
          contains_pii?: boolean;
        }>;
        const mapped = list.map((e) =>
          eventEnvelopeToTimelineEvent({
            event_id: e.event_id,
            tenant_id: tenantId,
            source: e.source,
            source_event_id: e.source_event_id ?? "",
            event_type: e.event_type,
            conversation_id: e.conversation_id ?? "",
            actor_type: e.actor_type ?? "system",
            actor_id: e.actor_id ?? "",
            actor_name: e.actor_name ?? null,
            occurred_at: e.occurred_at,
            ingested_at: e.ingested_at ?? e.occurred_at,
            payload: e.payload ?? {},
            contains_pii: e.contains_pii ?? false,
          })
        );
        setTimelineBuffer(mapped);
      })
      .catch(() => {})
      .finally(() => {
        if (!closed) setTimelineLoading(false);
      });

    const LIVE_STREAM_ID = "live-api";
    const cleanup = subscribeToStream(
      eventsManagerUrl,
      { tenantId, eventType: timelineFilter !== "all" ? timelineFilter : undefined },
      (dto) => {
        if (closed) return;
        if (dto.event_type === "system.connected") return;
        const te = eventEnvelopeToTimelineEvent(dto);
        setTimelineBuffer((prev) => [...prev, te]);
        setNewEventsCount((n) => n + 1);
        const rec = recordingStateRef.current;
        if (rec.kind === "Recording") {
          const shouldRecord = rec.recordingStreamIds.includes(LIVE_STREAM_ID);
          if (shouldRecord) {
            recordingBufferRef.current.push(te);
            setRecordingState(
              recRecording(rec.startedAt, rec.eventCount + 1, rec.recordingStreamIds)
            );
          }
        }
      }
    );
    setSseConnected(true);
    return () => {
      closed = true;
      cleanup();
      setSseConnected(false);
    };
  }, [viewTab, tenantId, eventsManagerUrl, timelineFilter]);

  const prevRecordingKindRef = useRef<RecordingState["kind"]>(REC_IDLE.kind);
  useEffect(() => {
    if (prevRecordingKindRef.current !== "Recording" && recordingState.kind === "Recording") {
      recordingBufferRef.current = [];
    }
    prevRecordingKindRef.current = recordingState.kind;
  }, [recordingState.kind, recordingState]);

  const handleSaveRecordingRequested = useCallback(() => {
    const buffer = recordingBufferRef.current;
    if (buffer.length === 0) return;
    const json = JSON.stringify(buffer, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const name = `recording-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.json`;
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    recordingBufferRef.current = [];
  }, []);

  const unloadMessengerWidget = useCallback(() => {
    const w = window as Window & { Intercom?: (action: string) => void; intercomSettings?: unknown };
    w.Intercom?.("shutdown");
    w.intercomSettings = undefined;
    delete (window as unknown as Record<string, unknown>)["Intercom"];
    const script = messengerScriptRef.current;
    if (script?.parentNode) {
      script.parentNode.removeChild(script);
    }
    messengerScriptRef.current = null;
    document.querySelectorAll('script[src^="https://widget.intercom.io/widget/"]').forEach((el) => el.remove());
  }, []);

  const loadMessengerWidget = useCallback((appId: string) => {
    unloadMessengerWidget();
    (window as Window & { intercomSettings?: Record<string, unknown> }).intercomSettings = {
      app_id: appId,
      hide_default_launcher: true,
      z_index: 99999,
    };
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://widget.intercom.io/widget/${appId}`;
    script.onload = () => {
      messengerScriptRef.current = script;
      setMessengerStatus("loaded");
      setMessengerError("");
      localStorage.setItem(MESSENGER_STORAGE_KEY, JSON.stringify({ provider: "intercom", appId }));
    };
    script.onerror = () => {
      setMessengerStatus("error");
      setMessengerError("Could not load the messenger. Check the App ID and try again.");
    };
    document.body.appendChild(script);
  }, [unloadMessengerWidget]);

  useEffect(() => {
    if (!hasActiveIntercom) return;
    const raw = localStorage.getItem(MESSENGER_STORAGE_KEY);
    if (!raw) return;
    let stored: StoredMessenger;
    try {
      stored = JSON.parse(raw) as StoredMessenger;
    } catch {
      return;
    }
    if (stored?.provider === "intercom" && typeof stored?.appId === "string" && stored.appId.trim()) {
      setMessengerProvider("intercom");
      setMessengerAppId(stored.appId.trim());
      setMessengerStep("appId");
      setMessengerStatus("loading");
      loadMessengerWidget(stored.appId.trim());
    }
  }, [hasActiveIntercom, loadMessengerWidget]);

  const handleMessengerChooseProvider = (provider: string) => {
    setMessengerProvider(provider);
    setMessengerStep("appId");
    setMessengerAppId("");
    setMessengerStatus("idle");
    setMessengerError("");
  };

  const handleMessengerBackToProvider = () => {
    unloadMessengerWidget();
    localStorage.removeItem(MESSENGER_STORAGE_KEY);
    setMessengerProvider(null);
    setMessengerStep("provider");
    setMessengerAppId("");
    setMessengerStatus("idle");
    setMessengerError("");
  };

  const handleMessengerLoad = () => {
    const appId = messengerAppId.trim();
    if (!appId) {
      setMessengerError("Enter your Intercom workspace App ID.");
      setMessengerStatus("error");
      return;
    }
    setMessengerError("");
    setMessengerStatus("loading");
    loadMessengerWidget(appId);
  };

  const handleMessengerChangeAppId = () => {
    unloadMessengerWidget();
    localStorage.removeItem(MESSENGER_STORAGE_KEY);
    setMessengerStatus("idle");
    setMessengerError("");
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("en-US", { hour12: false }) + " " + 
           date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getEventIcon = (eventType: string) => {
    if (eventType.includes("message") || eventType.includes("replied")) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      );
    }
    if (eventType.includes("conversation")) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
        </svg>
      );
    }
    if (eventType.includes("ticket")) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
        </svg>
      );
    }
    if (eventType.includes("user")) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      );
    }
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    );
  };

  const getActorBadge = (actorType: string) => {
    switch (actorType) {
      case "customer":
        return "badge--data";
      case "agent":
        return "badge--nominal";
      default:
        return "badge--neutral";
    }
  };

  const floatingMessengerUI = hasActiveIntercom ? (
    <>
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col-reverse items-end gap-3" style={{ isolation: "isolate" }}>
        <button
          type="button"
          onClick={() => setMessengerPanelOpen((o) => !o)}
          className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg hover:opacity-90 transition-opacity border-2 border-data flex-shrink-0"
          style={{ background: "var(--data)", color: "var(--black)" }}
          title="Open messenger to verify events"
          aria-label="Open messenger panel"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
          </svg>
        </button>
        {messengerPanelOpen && (
          <div className="panel w-[320px] max-h-[min(420px,70vh)] flex flex-col border-border-default shadow-lg flex-shrink-0">
            <div className="panel__header flex items-center justify-between flex-shrink-0">
              <span className="panel__title">Open messenger</span>
              <button
                type="button"
                onClick={() => setMessengerPanelOpen(false)}
                className="p-1 text-tertiary hover:text-primary transition-colors"
                aria-label="Close"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="panel__content space-y-4 overflow-y-auto min-h-0">
              {messengerStep === "provider" ? (
                <>
                  <p className="text-xs text-tertiary">
                    Choose a provider to open its messenger and send test events. Events will appear here.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleMessengerChooseProvider("intercom")}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-elevated border border-border-default hover:border-data transition-colors text-left"
                  >
                    <span className="w-8 h-8 bg-data-bg border border-data flex items-center justify-center text-data font-mono text-xs font-bold">IN</span>
                    <span className="text-sm font-medium text-primary">Intercom</span>
                  </button>
                </>
              ) : (
                <>
                  {messengerStatus === "loaded" ? (
                    <>
                      <p className="text-xs text-tertiary">
                        Currently: <span className="font-mono text-data">{messengerProvider}</span> – <span className="font-mono text-secondary">{messengerAppId}</span>
                      </p>
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const w = window as Window & { Intercom?: (action: string) => void };
                            w.Intercom?.("show");
                          }}
                          className="btn btn--primary w-full text-sm"
                        >
                          Open messenger
                        </button>
                        <button
                          type="button"
                          onClick={handleMessengerChangeAppId}
                          className="btn btn--secondary w-full text-sm"
                        >
                          Change App ID
                        </button>
                        <button
                          type="button"
                          onClick={handleMessengerBackToProvider}
                          className="btn btn--ghost w-full text-sm text-tertiary"
                        >
                          Choose another provider
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-tertiary">
                        Enter your Intercom workspace App ID. Load the messenger to send test events.
                      </p>
                      <label htmlFor="events-messenger-app-id" className="block text-xs text-tertiary uppercase tracking-wide mb-1">
                        App ID
                      </label>
                      <input
                        id="events-messenger-app-id"
                        type="text"
                        value={messengerAppId}
                        onChange={(e) => setMessengerAppId(e.target.value)}
                        placeholder="e.g. rf0pkb6p"
                        className="input mb-2"
                        disabled={messengerStatus === "loading"}
                      />
                      {messengerStatus === "loading" && <p className="text-xs text-tertiary">Loading…</p>}
                      {messengerStatus === "error" && messengerError && <p className="text-xs text-critical">{messengerError}</p>}
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={handleMessengerLoad}
                          disabled={messengerStatus === "loading"}
                          className="btn btn--primary w-full"
                        >
                          {messengerStatus === "loading" ? "Loading…" : "Load messenger"}
                        </button>
                        <button
                          type="button"
                          onClick={handleMessengerBackToProvider}
                          className="btn btn--ghost w-full text-sm text-tertiary"
                        >
                          Choose another provider
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  ) : null;

  const tabBar = (
    <div className="flex gap-1 border-b border-border-default mb-4">
      <button
        type="button"
        onClick={() => setViewTab("list")}
        className={`px-4 py-2 text-lg font-medium transition-colors ${
          viewTab === "list" ? "text-data border-b-2 border-data bg-transparent" : "text-tertiary hover:text-primary"
        }`}
      >
        List
      </button>
      <button
        type="button"
        onClick={() => setViewTab("timeline")}
        className={`px-4 py-2 text-lg font-medium transition-colors ${
          viewTab === "timeline" ? "text-data border-b-2 border-data bg-transparent" : "text-tertiary hover:text-primary"
        }`}
      >
        Timeline
      </button>
    </div>
  );

  // Loading state (list view only)
  if (viewTab === "list" && loading && events.length === 0) {
    return (
      <>
        <EventsListSkeleton tabBar={tabBar} />
        {floatingMessengerUI}
      </>
    );
  }

  // Error state (list view only)
  if (viewTab === "list" && error) {
    return (
      <>
      <div className="space-y-6">
        {tabBar}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-tertiary tracking-wide uppercase mb-1">Event Stream</div>
            <h1 className="text-2xl font-semibold text-primary">Events</h1>
          </div>
        </div>

        <div className="panel border-caution-dim">
          <div className="flex items-center justify-between px-4 py-3 bg-caution-bg border-b border-caution-dim">
            <div className="flex items-center gap-3">
              <div className="status-dot status-dot--caution" />
              <span className="text-sm font-medium text-caution">Connection Error</span>
            </div>
          </div>
          <div className="panel__content">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 border border-caution-dim bg-caution-bg flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-caution" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div className="text-base font-medium text-primary mb-2">Unable to connect to Events Manager</div>
              <div className="text-sm text-tertiary mb-2">{error}</div>
              <div className="font-mono text-xs text-disabled mb-6">
                Endpoint: {eventsManagerUrl}
              </div>
              <button onClick={fetchEvents} className="btn btn--primary">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                Retry Connection
              </button>
            </div>
          </div>
        </div>
      </div>
      {floatingMessengerUI}
      </>
    );
  }

  // Empty state (list view only)
  if (viewTab === "list" && events.length === 0) {
    return (
      <>
        <div className="space-y-6">
        {tabBar}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-tertiary tracking-wide uppercase mb-1">Event Stream</div>
            <h1 className="text-2xl font-semibold text-primary">Events</h1>
          </div>
          <button onClick={fetchEvents} className="btn btn--secondary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Refresh
          </button>
        </div>

        <div className="panel">
          <div className="flex items-center justify-between px-4 py-3 bg-data-bg border-b border-data-dim">
            <div className="flex items-center gap-3">
              <div className="status-dot status-dot--data" />
              <span className="text-sm font-medium text-data">Awaiting Events</span>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel__content">
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 border border-border-default bg-elevated flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </div>
              <div className="text-base font-medium text-primary mb-2">No events recorded</div>
              <div className="text-sm text-tertiary mb-6 max-w-sm">
                Events will appear here once data sources begin transmitting. Verify webhook configuration.
              </div>
              <a href="/dashboard/connections" className="btn btn--primary">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Check Connections
              </a>
            </div>
          </div>
        </div>
      </div>
        {floatingMessengerUI}
      </>
    );
  }

  // Main events view (list or timeline)
  const selectedTimelineEvent = selectedTimelineEventId
    ? timelineBuffer.find((e) => e.id === selectedTimelineEventId) ?? null
    : null;

  return (
    <>
    <div className="space-y-6">
      {tabBar}

      {viewTab === "timeline" ? (
        <>
          <StreamsPanel
            recordingState={recordingState}
            onRecordingStateChange={setRecordingState}
            onSaveRecordingRequested={handleSaveRecordingRequested}
          />
          <div className="panel flex items-center justify-between px-4 py-3 bg-elevated border-b border-border-default">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-tertiary">
                {sseConnected ? "STREAMING" : "DISCONNECTED"}
              </span>
              <span className="text-xs text-tertiary">
                {timelinePlayback === "live" ? "LIVE MODE" : "PAUSED"}
              </span>
              <button
                type="button"
                onClick={() => {
                  setTimelineBuffer([]);
                  setNewEventsCount(0);
                }}
                className="btn btn--ghost text-xs"
              >
                CLEAR
              </button>
              <span className="font-mono text-xs tabular-nums">
                {timelineBuffer.length} events
                {newEventsCount > 0 ? (
                  <span className="ml-2 text-data">+{newEventsCount} NEW</span>
                ) : null}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <select
              value={timelineFilter}
              onChange={(e) => setTimelineFilter(e.target.value)}
              className="px-3 py-1.5 bg-base border border-border-default text-sm"
            >
              <option value="all">All Sources</option>
              <option value="intercom">Intercom</option>
            </select>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2" style={{ minHeight: 400 }}>
              {timelineLoading ? (
                <div className="panel overflow-hidden">
                  <div className="p-4 border-b border-border-dim space-y-2">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <div className="p-4">
                    <Skeleton className="w-full min-h-[360px] rounded-md" />
                  </div>
                </div>
              ) : (
                <TimelinePanel
                  events={timelineBuffer}
                  playback={timelinePlayback}
                  selectedEventId={selectedTimelineEventId}
                  onPlaybackChange={setTimelinePlayback}
                  onSelect={({ eventId }) => {
                    setSelectedTimelineEventId(eventId);
                  }}
                  onPlayheadChange={() => {}}
                  onRangeChange={() => {}}
                />
              )}
            </div>
            <div>
              <EventDetailPanel event={selectedTimelineEvent} />
            </div>
          </div>
        </>
      ) : (
        <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-tertiary tracking-wide uppercase mb-1">Event Stream</div>
          <h1 className="text-2xl font-semibold text-primary">Events</h1>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-1.5 bg-base border border-border-default text-sm focus:outline-none focus:border-data"
          >
            <option value="all">All Sources</option>
            <option value="intercom">Intercom</option>
          </select>
          
          <button onClick={fetchEvents} disabled={loading} className="btn btn--secondary">
            <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Status Banner */}
      <div className="panel">
        <div className="flex items-center justify-between px-4 py-3 bg-nominal-bg border-b border-nominal-dim">
          <div className="flex items-center gap-3">
            <div className="status-dot status-dot--nominal status-dot--pulse" />
            <span className="text-sm font-medium text-nominal">
              Live · {events.length} event{events.length !== 1 ? "s" : ""} captured
            </span>
          </div>
          <span className="font-mono text-xs text-nominal tabular-nums">
            Last update: {new Date().toLocaleTimeString('en-US', { hour12: false })}
          </span>
        </div>
      </div>

      {/* Events Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Event List */}
        <div className="lg:col-span-2 panel">
          <div className="panel__header">
            <span className="panel__title">Event Log</span>
            <span className="badge badge--data">{events.length} Total</span>
          </div>
          <div className="divide-y divide-border-dim max-h-[600px] overflow-y-auto">
            {events.map((event) => (
              <div
                key={event.event_id}
                onClick={() => setSelectedEvent(event)}
                className={`flex items-center gap-4 px-4 py-3 cursor-pointer transition-colors ${
                  selectedEvent?.event_id === event.event_id
                    ? "bg-data-bg border-l-2 border-data"
                    : "hover:bg-hover border-l-2 border-transparent"
                }`}
              >
                <div className={`w-8 h-8 flex items-center justify-center ${
                  selectedEvent?.event_id === event.event_id ? "text-data" : "text-tertiary"
                }`}>
                  {getEventIcon(event.event_type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${
                      selectedEvent?.event_id === event.event_id ? "text-data" : "text-primary"
                    }`}>
                      {event.event_type}
                    </span>
                    <span className={`badge ${getActorBadge(getActorType(event))}`}>
                      {getActorType(event)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-tertiary">{event.source}</span>
                    <span className="text-xs text-disabled">·</span>
                    <span className="font-mono text-xs text-tertiary tabular-nums">{formatTime(event.occurred_at)}</span>
                  </div>
                </div>

                <svg className={`w-4 h-4 ${
                  selectedEvent?.event_id === event.event_id ? "text-data" : "text-tertiary"
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            ))}
          </div>
        </div>

        {/* Event Details Panel */}
        <div className="panel">
          <div className="panel__header">
            <span className="panel__title">Event Details</span>
            {selectedEvent && <div className="status-dot status-dot--data" />}
          </div>
          <div className="panel__content">
            {selectedEvent ? (
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-tertiary tracking-wide uppercase mb-1">Event ID</div>
                  <div className="font-mono text-xs text-secondary break-all bg-base px-2 py-1.5 border border-border-dim">
                    {selectedEvent.event_id}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-tertiary tracking-wide uppercase mb-1">Type</div>
                  <div className="text-sm text-data font-medium">{selectedEvent.event_type}</div>
                </div>

                <div>
                  <div className="text-xs text-tertiary tracking-wide uppercase mb-1">Source</div>
                  <div className="text-sm text-primary">{selectedEvent.source}</div>
                </div>

                <div>
                  <div className="text-xs text-tertiary tracking-wide uppercase mb-1">Actor</div>
                  <div className="flex items-center gap-2">
                    <span className={`badge ${getActorBadge(getActorType(selectedEvent))}`}>
                      {getActorType(selectedEvent)}
                    </span>
                    <span className="text-sm text-secondary">{getActorDisplay(selectedEvent)}</span>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-tertiary tracking-wide uppercase mb-1">Conversation ID</div>
                  <div className="font-mono text-xs text-secondary break-all">{getConversationId(selectedEvent)}</div>
                </div>

                <div>
                  <div className="text-xs text-tertiary tracking-wide uppercase mb-1">Timestamp</div>
                  <div className="font-mono text-sm text-primary tabular-nums">{new Date(selectedEvent.occurred_at).toLocaleString()}</div>
                </div>

                <div>
                  <div className="text-xs text-tertiary tracking-wide uppercase mb-1">Payload</div>
                  <pre className="font-mono text-xs text-secondary bg-base border border-border-dim p-3 overflow-auto max-h-48">
                    {JSON.stringify(selectedEvent.payload || {}, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-12 h-12 border border-border-dim bg-elevated flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59" />
                  </svg>
                </div>
                <div className="text-sm text-tertiary">Select an event to view details</div>
              </div>
            )}
          </div>
        </div>
      </div>
        </>
      )}
    </div>
    {floatingMessengerUI}
    </>
  );
}
