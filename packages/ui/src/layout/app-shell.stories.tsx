import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

import { Button } from "../primitives/button";
import { FilterPill } from "../primitives/filter-pill";
import { Priority } from "../primitives/priority";
import { Status } from "../primitives/status";
import {
  Minimap,
  TimelineLane,
  type MinimapBar,
  type TimelineEvent,
  type TimelineGroupBy,
  type TimelineSource,
  type TimelineTrace,
} from "../product";
import { AppShell } from "./app-shell";
import { FilterBar } from "./filter-bar";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";

const HOUR = 60 * 60 * 1000;

const SOURCES: TimelineSource[] = [
  { id: "intercom", label: "intercom", color: "var(--c-event-teal)" },
  { id: "shopify", label: "shopify", color: "var(--c-event-amber)" },
  { id: "stripe", label: "stripe", color: "var(--c-event-green)" },
  { id: "ops", label: "ops", color: "var(--c-event-orange)" },
  { id: "slack", label: "slack", color: "var(--c-event-pink)" },
  { id: "agent", label: "agent", color: "var(--c-ember)" },
];

const TRACES: TimelineTrace[] = [
  trace("CHR-1284", "Refund · wrong shipping address", {
    customer: "Sarah Chen",
    customerInitials: "SC",
    region: "EU",
    priority: "urgent",
    outcome: "fail",
    status: "canceled",
    startMin: 6,
    spans: [
      span("intercom", "conversation.created", 6, 4.8, [
        timelineEvent(
          "intercom",
          "created",
          6.1,
          "Customer reports failed delivery"
        ),
        timelineEvent(
          "intercom",
          "message.received",
          9.8,
          "Address typo confirmed"
        ),
      ]),
      span("shopify", "order.lookup", 10.2, 1.4, [
        timelineEvent("shopify", "lookup", 10.3, "order_8821 delivered Feb 12"),
      ]),
      span(
        "agent",
        "tool.escalate",
        12.1,
        0.8,
        [
          timelineEvent(
            "agent",
            "escalate",
            12.1,
            "shipping_error · priority tier",
            "error"
          ),
        ],
        "error"
      ),
      span("slack", "channel.post", 13.4, 0.4, [
        timelineEvent("slack", "post", 13.4, "#shipping-issues notified"),
      ]),
      span("stripe", "refund.created", 16.1, 0.7, [
        timelineEvent("stripe", "refund", 16.1, "$84.00 refund issued"),
      ]),
    ],
  }),
  trace("CHR-1285", "Bulk import · validation failures", {
    customer: "Globex",
    customerInitials: "GX",
    region: "US",
    priority: "high",
    outcome: "partial",
    status: "inprogress",
    startMin: 18,
    spans: [
      span("ops", "job.started", 18, 0.8, [
        timelineEvent("ops", "started", 18, "14,200 row import started"),
      ]),
      span(
        "agent",
        "schema.validate",
        19.2,
        3.2,
        [
          timelineEvent(
            "agent",
            "validate",
            19.3,
            "422 malformed records",
            "warn"
          ),
        ],
        "warn"
      ),
      span("slack", "channel.post", 23.2, 0.2, [
        timelineEvent("slack", "post", 23.2, "#data-import alert"),
      ]),
    ],
  }),
  trace("CHR-1278", "p95 latency spike · ticket-fetch", {
    customer: "System",
    customerInitials: "SYS",
    region: "global",
    priority: "med",
    outcome: "partial",
    status: "inprogress",
    startMin: 29,
    spans: [
      span(
        "ops",
        "latency.detected",
        29,
        1.5,
        [timelineEvent("ops", "alert", 29, "p95 420ms -> 780ms", "warn")],
        "warn"
      ),
      span("agent", "ticket.fetch", 30.7, 6.4, [
        timelineEvent("agent", "fetch", 30.8, "slow vendor response"),
        timelineEvent("agent", "retry", 35.4, "retry completed"),
      ]),
    ],
  }),
  trace("CHR-1283", "Chargeback · Acme Corp $2,400", {
    customer: "Acme Corp",
    customerInitials: "AC",
    region: "US",
    priority: "high",
    outcome: "pass",
    status: "done",
    startMin: 38,
    spans: [
      span("stripe", "dispute.created", 38, 0.3, [
        timelineEvent("stripe", "dispute", 38, "charge disputed · $2,400"),
      ]),
      span("intercom", "conversation.created", 40, 4.2, [
        timelineEvent(
          "intercom",
          "created",
          40,
          "Customer claims unauthorized charge"
        ),
      ]),
      span("agent", "evidence.submit", 45, 2.6, [
        timelineEvent(
          "agent",
          "submit",
          45.1,
          "invoice.pdf + purchase log submitted"
        ),
      ]),
      span("slack", "channel.post", 52, 0.2, [
        timelineEvent("slack", "post", 52, "#billing dispute won"),
      ]),
    ],
  }),
  trace("CHR-1276", "Self-serve cancellation", {
    customer: "Priya R.",
    customerInitials: "PR",
    region: "APAC",
    priority: "low",
    outcome: "pass",
    status: "done",
    startMin: 50,
    spans: [
      span("intercom", "conversation.opened", 50, 1.4, [
        timelineEvent("intercom", "opened", 50, "Cancellation requested"),
      ]),
      span("agent", "retention.offer", 52, 2.3, [
        timelineEvent("agent", "offer", 52, "Pause plan offered"),
      ]),
      span("stripe", "subscription.paused", 55, 0.5, [
        timelineEvent("stripe", "pause", 55, "subscription paused until July"),
      ]),
    ],
  }),
];

const meta: Meta<typeof AppShell> = {
  title: "Layout/AppShell",
  component: AppShell,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof AppShell>;

export const Timeline: Story = { render: () => <TimelineShell /> };

function TimelineShell() {
  const [activeSources, setActiveSources] = React.useState(
    () => new Set(SOURCES.map((source) => source.id))
  );
  const [outcome, setOutcome] = React.useState<"any" | "fail" | "partial">(
    "fail"
  );
  const [priority, setPriority] = React.useState<"any" | "urgent" | "high">(
    "urgent"
  );
  const [groupBy, setGroupBy] = React.useState<TimelineGroupBy>("outcome");
  const [win, setWin] = React.useState<[number, number]>([0.05, 0.94]);
  const [selectedTraceId, setSelectedTraceId] = React.useState<string | null>(
    "CHR-1284"
  );
  const [selectedEventId, setSelectedEventId] = React.useState<string | null>(
    null
  );

  const filtered = React.useMemo(() => {
    const start = win[0] * HOUR;
    const end = win[1] * HOUR;
    return TRACES.filter((trace) => {
      if (outcome !== "any" && trace.outcome !== outcome) return false;
      if (priority !== "any" && trace.priority !== priority) return false;
      if (
        !trace.spans.some((timelineSpan) =>
          activeSources.has(timelineSpan.source)
        )
      ) {
        return false;
      }
      const traceStart = trace.startedAtMs;
      const traceEnd = trace.startedAtMs + trace.durationMs;
      return traceEnd >= start && traceStart <= end;
    });
  }, [activeSources, outcome, priority, win]);

  const selectedTrace =
    TRACES.find((trace) => trace.id === selectedTraceId) ?? null;
  const selectedEvent =
    selectedEventId && selectedTrace
      ? selectedTrace.spans
          .flatMap((timelineSpan) => timelineSpan.events)
          .find((timelineEvent) => timelineEvent.id === selectedEventId)
      : null;

  const minimapBars = React.useMemo(() => buildMinimapBars(TRACES), []);

  const filterChanged =
    outcome !== "any" ||
    priority !== "any" ||
    activeSources.size !== SOURCES.length;

  const toggleSource = (sourceId: string) => {
    setActiveSources((current) => {
      const next = new Set(current);
      if (next.has(sourceId)) next.delete(sourceId);
      else next.add(sourceId);
      return next;
    });
  };

  const clearFilters = () => {
    setOutcome("any");
    setPriority("any");
    setActiveSources(new Set(SOURCES.map((source) => source.id)));
  };

  return (
    <div className="h-screen w-screen">
      <AppShell
        style={{ height: "100vh" }}
        navWidth={224}
        detailWidth={360}
        topbar={
          <TopBar>
            <TopBar.Crumb>
              Chronicle <TopBar.CrumbSep /> support-agent <TopBar.CrumbSep />
              <TopBar.CrumbActive>Timeline</TopBar.CrumbActive>
            </TopBar.Crumb>
            <TopBar.Spacer />
            <TopBar.Live on />
            <TopBar.TimeSelector>Last 1h · 1s resolution</TopBar.TimeSelector>
            <TopBar.SearchTrigger />
          </TopBar>
        }
        filterBar={
          <FilterBar>
            {outcome !== "any" ? (
              <FilterPill
                icon={<TriangleIcon />}
                dimension="Outcome"
                value={outcome === "fail" ? "Failed" : "Partial"}
                onRemove={() => setOutcome("any")}
              />
            ) : null}
            {priority !== "any" ? (
              <FilterPill
                icon={<BoltIcon />}
                dimension="Priority"
                value={priority === "urgent" ? "Urgent" : "High"}
                onRemove={() => setPriority("any")}
              />
            ) : null}
            <FilterBar.AddFilter label={filterChanged ? "" : "Filter"} />
            {filterChanged ? <FilterBar.Clear onClick={clearFilters} /> : null}
            <FilterBar.Divider />
            <FilterBar.Display
              changed={groupBy !== "none"}
              onClick={() =>
                setGroupBy((current) =>
                  current === "outcome"
                    ? "customer"
                    : current === "customer"
                      ? "none"
                      : "outcome"
                )
              }
              label={groupBy === "none" ? "Display" : `Group: ${groupBy}`}
            />
            <FilterBar.Spacer />
            <FilterBar.Count
              shown={filtered.length}
              total={TRACES.length}
              unit="traces"
            />
          </FilterBar>
        }
        nav={
          <Sidebar variant="static" width="md">
            <Sidebar.Header>
              <span className="flex h-[22px] w-[22px] items-center justify-center rounded-xs bg-ember font-display text-[12px] font-semibold text-white">
                C
              </span>
              <span className="ml-s-2 text-[13px] font-medium text-l-ink">
                Chronicle
              </span>
            </Sidebar.Header>
            <Sidebar.Nav aria-label="Timeline">
              <Sidebar.NavSection title="Workspace">
                <Sidebar.NavItem status={12}>Inbox</Sidebar.NavItem>
                <Sidebar.NavItem isActive>Timeline</Sidebar.NavItem>
                <Sidebar.NavItem>Saved views</Sidebar.NavItem>
              </Sidebar.NavSection>
              <Sidebar.NavSection title="Views">
                <Sidebar.NavItem
                  isActive={groupBy !== "none"}
                  status={filtered.length}
                  onPress={() => setGroupBy("outcome")}
                >
                  Timeline · Traces
                </Sidebar.NavItem>
                <Sidebar.NavItem onPress={() => setGroupBy("customer")}>
                  Timeline · Customers
                </Sidebar.NavItem>
                <Sidebar.NavItem onPress={() => setGroupBy("none")}>
                  List
                </Sidebar.NavItem>
              </Sidebar.NavSection>
              <Sidebar.NavSection title="Saved filters">
                <Sidebar.NavItem
                  status={2}
                  statusTone="critical"
                  onPress={() => {
                    setOutcome("fail");
                    setPriority("urgent");
                  }}
                >
                  Urgent + Failed
                </Sidebar.NavItem>
                <Sidebar.NavItem status={3}>Enterprise</Sidebar.NavItem>
                <Sidebar.NavItem status={8}>Last 15 min</Sidebar.NavItem>
              </Sidebar.NavSection>
              <Sidebar.NavSection title="Sources">
                {SOURCES.map((source) => (
                  <Sidebar.NavItem
                    key={source.id}
                    isActive={activeSources.has(source.id)}
                    status={countSourceEvents(source.id)}
                    onPress={() => toggleSource(source.id)}
                    icon={
                      <span
                        className="h-[6px] w-[6px] rounded-pill"
                        style={{ background: source.color }}
                      />
                    }
                  >
                    {source.label}
                  </Sidebar.NavItem>
                ))}
              </Sidebar.NavSection>
            </Sidebar.Nav>
          </Sidebar>
        }
        detail={
          <TraceDetail
            trace={selectedTrace}
            event={selectedEvent ?? null}
            onClose={() => {
              setSelectedTraceId(null);
              setSelectedEventId(null);
            }}
          />
        }
      >
        <div className="flex h-full min-h-0 flex-col">
          <Minimap
            bars={minimapBars}
            window={win}
            onWindowChange={setWin}
            rulerLabels={[
              "14:00",
              "14:10",
              "14:20",
              "14:30",
              "14:40",
              "14:50",
              "15:00",
            ]}
            readoutLeft={`Timeline · 60 min · ${TRACES.length} traces · ${countEvents(TRACES)} events`}
            readoutRight="Drag window to zoom"
          />
          <TimelineLane
            traces={filtered}
            sources={SOURCES}
            window={win}
            durationMs={HOUR}
            groupBy={groupBy}
            selectedTraceId={selectedTraceId}
            selectedEventId={selectedEventId}
            onSelectTrace={(traceId) => {
              setSelectedTraceId(traceId);
              setSelectedEventId(null);
            }}
            onSelectEvent={(traceId, eventId) => {
              setSelectedTraceId(traceId);
              setSelectedEventId(eventId);
            }}
          />
        </div>
      </AppShell>
    </div>
  );
}

function TraceDetail({
  trace,
  event,
  onClose,
}: {
  trace: TimelineTrace | null;
  event: TimelineEvent | null;
  onClose: () => void;
}) {
  if (!trace) {
    return (
      <aside className="flex h-full flex-col justify-center bg-l-surface-raised px-s-5 text-[13px] text-l-ink-lo">
        <div className="font-display text-[18px] font-medium text-l-ink">
          Select a trace
        </div>
        <p className="mt-s-2 max-w-[28ch]">
          Pick a trace or event to inspect timing, source, and replay actions.
        </p>
      </aside>
    );
  }

  return (
    <aside className="flex h-full flex-col bg-l-surface-raised">
      <div className="border-b border-l-border-faint px-s-4 py-s-3">
        <div className="flex items-center gap-s-2 font-mono text-[10.5px] uppercase tracking-eyebrow text-l-ink-dim">
          <Status kind={trace.status} />
          <span>{trace.id} · Trace</span>
          <button
            type="button"
            aria-label="Close detail"
            onClick={onClose}
            className="ml-auto rounded-md px-[6px] py-[2px] text-l-ink-dim hover:bg-l-wash-3 hover:text-l-ink"
          >
            ×
          </button>
        </div>
        <h3 className="mt-[6px] font-display text-[20px] font-medium leading-tight text-l-ink">
          {trace.title}
        </h3>
        {event ? (
          <p className="mt-s-2 text-[12px] text-l-ink-lo">{event.preview}</p>
        ) : null}
      </div>
      <div className="flex-1 overflow-auto px-s-4 py-s-3">
        <DetailField label="Status">
          <Status kind={trace.status} />
          {trace.outcome}
        </DetailField>
        <DetailField label="Priority">
          <Priority level={trace.priority ?? "none"} />
          {trace.priority ?? "none"}
        </DetailField>
        <DetailField label="Customer">{trace.customer}</DetailField>
        <DetailField label="Region">{trace.region}</DetailField>
        <DetailField label="Duration">
          {formatDuration(trace.durationMs)}
        </DetailField>
        {event ? (
          <>
            <div className="my-s-3 h-px bg-l-border-faint" />
            <DetailField label="Event">{event.op}</DetailField>
            <DetailField label="Source">{event.source}</DetailField>
            <DetailField label="Time">
              {formatClock(event.timestampMs)}
            </DetailField>
          </>
        ) : null}
      </div>
      <div className="flex items-center gap-s-2 border-t border-l-border-faint px-s-4 py-s-3">
        <Button variant="secondary" size="sm">
          Open trace
        </Button>
        <Button variant="primary" size="sm">
          Run replay
        </Button>
      </div>
    </aside>
  );
}

function DetailField({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[80px_1fr] items-center gap-s-3 py-[6px] text-[13px]">
      <span className="text-l-ink-lo">{label}</span>
      <span className="flex items-center gap-s-2 text-l-ink">{children}</span>
    </div>
  );
}

function trace(
  id: string,
  title: string,
  config: Omit<TimelineTrace, "id" | "title" | "startedAtMs" | "durationMs"> & {
    startMin: number;
  }
): TimelineTrace {
  const startedAtMs = config.startMin * 60_000;
  const spans = config.spans.map((timelineSpan) => ({
    ...timelineSpan,
    traceId: id,
    events: timelineSpan.events.map((timelineEvent) => ({
      ...timelineEvent,
      traceId: id,
    })),
  }));
  const durationMs =
    Math.max(
      ...spans.map(
        (timelineSpan) => timelineSpan.startMs + timelineSpan.durationMs
      )
    ) - startedAtMs;
  return {
    ...config,
    id,
    title,
    spans,
    startedAtMs,
    durationMs,
  };
}

function span(
  source: string,
  op: string,
  startMin: number,
  durationMin: number,
  events: TimelineEvent[],
  status: "ok" | "warn" | "error" = "ok"
) {
  const startMs = startMin * 60_000;
  const traceId = events[0]?.traceId ?? "";
  return {
    id: `${source}-${op}-${startMin}`,
    traceId,
    source,
    op,
    startMs,
    durationMs: durationMin * 60_000,
    status,
    events,
  };
}

function timelineEvent(
  source: string,
  op: string,
  atMin: number,
  preview: string,
  level: "info" | "warn" | "error" = "info"
): TimelineEvent {
  return {
    id: `${source}-${op}-${atMin}`,
    traceId: "",
    source,
    op,
    timestampMs: atMin * 60_000,
    preview,
    level,
  };
}

function buildMinimapBars(traces: TimelineTrace[]): MinimapBar[] {
  const bars = Array.from({ length: 80 }, () => ({
    height: 8,
    color: "var(--l-ink-dim)",
    opacity: 0.25,
  }));

  for (const trace of traces) {
    for (const timelineEvent of trace.spans.flatMap(
      (timelineSpan) => timelineSpan.events
    )) {
      const index = Math.min(
        bars.length - 1,
        Math.floor((timelineEvent.timestampMs / HOUR) * bars.length)
      );
      const source = SOURCES.find(
        (candidate) => candidate.id === timelineEvent.source
      );
      bars[index] = {
        height: Math.min(100, bars[index].height + 18),
        color: source?.color ?? "var(--l-ink-dim)",
        opacity: 0.85,
      };
    }
  }

  return bars;
}

function countEvents(traces: TimelineTrace[]) {
  return traces.reduce(
    (total, trace) =>
      total +
      trace.spans.reduce(
        (spanTotal, timelineSpan) => spanTotal + timelineSpan.events.length,
        0
      ),
    0
  );
}

function countSourceEvents(source: string) {
  return TRACES.reduce(
    (total, trace) =>
      total +
      trace.spans.reduce(
        (spanTotal, timelineSpan) =>
          spanTotal +
          timelineSpan.events.filter(
            (timelineEvent) => timelineEvent.source === source
          ).length,
        0
      ),
    0
  );
}

function formatDuration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
}

function formatClock(ms: number): string {
  const base = new Date("2026-02-18T14:00:00Z").getTime();
  return new Date(base + ms).toISOString().slice(11, 16);
}

const TriangleIcon = () => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M8 2.5l5.5 10h-11z" />
  </svg>
);

const BoltIcon = () => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden
  >
    <path d="M9 2L3 9h4l-1 5 6-7H8l1-5z" />
  </svg>
);
