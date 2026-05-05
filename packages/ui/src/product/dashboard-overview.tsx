"use client";

import * as React from "react";

import { CompanyLogo } from "../icons";
import { useSetSiteBreadcrumb } from "../layout/site-breadcrumb";
import { Button } from "../primitives/button";
import { StatusDot, type StatusDotVariant } from "../primitives/status-dot";

export type DashboardMetricTone = "default" | "green" | "amber" | "red" | "ember";
export type DashboardActionTone = "deferred" | "review" | "diagnostic";
export type DashboardConnectionState = "ok" | "expired";

export interface DashboardMetric {
  label: string;
  value: string;
  delta: string;
  tone?: DashboardMetricTone;
}

export interface DashboardTimelineEvent {
  time: string;
  name: string;
  company: string;
  source: string;
  latency: string;
  dot: StatusDotVariant;
  muted?: boolean;
  live?: boolean;
}

export interface DashboardActionItem {
  tone: DashboardActionTone;
  label: string;
  detail: string;
}

export interface DashboardValidationRun {
  label: string;
  score: string;
  value: number;
  tone: "green" | "red";
}

export interface DashboardConnection {
  name: string;
  domain?: string;
  state: DashboardConnectionState;
  dot: StatusDotVariant;
}

export interface DashboardOverviewData {
  workspace: string;
  agent: string;
  title: string;
  subtitle: string;
  range: string;
  metrics: DashboardMetric[];
  timeline: DashboardTimelineEvent[];
  actions: DashboardActionItem[];
  validation: DashboardValidationRun[];
  connections: DashboardConnection[];
}

export const dashboardOverviewSeed: DashboardOverviewData = {
  workspace: "Chronicle",
  agent: "Support-agent",
  title: "Today’s signal.",
  subtitle:
    "A live look at what your agent is doing right now, and what’s waiting on you.",
  range: "Last 24h",
  metrics: [
    { label: "Events / 24h", value: "14,328", delta: "+ 122" },
    { label: "Active traces", value: "47", delta: "Live", tone: "green" },
    { label: "Interventions", value: "3", delta: "Review", tone: "ember" },
    { label: "Last backtest", value: "62.1%", delta: "Fail", tone: "red" },
  ],
  timeline: [
    {
      time: "24:04",
      name: "support.conversation.created",
      company: "intercom",
      source: "crm-042",
      latency: "118ms",
      dot: "teal",
    },
    {
      time: "24:06",
      name: "shopify.order.lookup",
      company: "shopify",
      source: "stripe",
      latency: "2.1s",
      dot: "amber",
    },
    {
      time: "24:09",
      name: "agent.response.generated",
      company: "openai",
      source: "job racing",
      latency: "320ms",
      dot: "green",
    },
    {
      time: "24:09",
      name: "ops.alert.triggered",
      company: "datadog",
      source: "gateway",
      latency: "pending",
      dot: "red",
    },
    {
      time: "24:12",
      name: "agent.tool.escalate()",
      company: "slack",
      source: "flagged for review",
      latency: "4.8s",
      dot: "orange",
    },
    {
      time: "24:18",
      name: "slack.channel.post",
      company: "slack",
      source: "app-notifier",
      latency: "940ms",
      dot: "pink",
    },
    {
      time: "24:18",
      name: "stripe.refund.create",
      company: "stripe",
      source: "api",
      latency: "144ms",
      dot: "green",
    },
    {
      time: "24:19",
      name: "intercom.conversation.tagged",
      company: "intercom",
      source: "crm-042",
      latency: "211ms",
      dot: "teal",
    },
    {
      time: "24:20",
      name: "openai.response.evaluated",
      company: "openai",
      source: "model-router",
      latency: "680ms",
      dot: "violet",
    },
    {
      time: "24:21",
      name: "datadog.trace.ingested",
      company: "datadog",
      source: "eval-worker",
      latency: "92ms",
      dot: "orange",
    },
    {
      time: "24:21",
      name: "shopify.customer.read",
      company: "shopify",
      source: "order-sync",
      latency: "1.4s",
      dot: "amber",
    },
    {
      time: "24:22",
      name: "slack.thread.updated",
      company: "slack",
      source: "ops-channel",
      latency: "188ms",
      dot: "pink",
    },
    {
      time: "24:23",
      name: "stripe.payment_intent.retrieve",
      company: "stripe",
      source: "tool-call",
      latency: "126ms",
      dot: "green",
    },
    {
      time: "24:24",
      name: "agent.policy.check",
      company: "openai",
      source: "guardrail",
      latency: "304ms",
      dot: "violet",
    },
    {
      time: "24:24",
      name: "support.priority.recalculated",
      company: "intercom",
      source: "crm-live",
      latency: "73ms",
      dot: "teal",
    },
  ],
  actions: [
    {
      tone: "deferred",
      label: "Deferred",
      detail: "v3.0.4 backtest failed at turn 5",
    },
    {
      tone: "review",
      label: "Review",
      detail: "17 traces tagged “escalation”",
    },
    {
      tone: "diagnostic",
      label: "Diagnostic",
      detail: "Intercom token expires in 4d",
    },
  ],
  validation: [
    { label: "v2.8 · baseline", score: "98.4%", value: 98.4, tone: "green" },
    { label: "v3.0.4 · candidate", score: "62.1% · fail", value: 62.1, tone: "red" },
  ],
  connections: [
    { name: "Intercom", state: "ok", dot: "teal" },
    { name: "Shopify", state: "ok", dot: "amber" },
    { name: "Stripe", state: "ok", dot: "green" },
    { name: "Slack", state: "ok", dot: "pink" },
    { name: "Datadog", domain: "datadoghq.com", state: "expired", dot: "orange" },
    { name: "OpenAI", domain: "openai.com", state: "ok", dot: "violet" },
  ],
};

const metricToneClass: Record<DashboardMetricTone, string> = {
  default: "text-ink-lo",
  green: "text-event-green",
  amber: "text-event-amber",
  red: "text-event-red",
  ember: "text-ember",
};

const actionToneClass: Record<DashboardActionTone, string> = {
  deferred: "border-ember/25 bg-[rgba(216,67,10,0.075)] text-ember",
  review: "border-event-amber/20 bg-[rgba(251,191,36,0.035)] text-event-amber",
  diagnostic: "border-hairline bg-wash-micro text-ink-dim",
};

const liveTimelineTemplates: Array<Omit<DashboardTimelineEvent, "time" | "latency">> = [
  {
    name: "support.conversation.updated",
    company: "intercom",
    source: "crm-live",
    dot: "teal",
  },
  {
    name: "shopify.fulfillment.read",
    company: "shopify",
    source: "order-sync",
    dot: "amber",
  },
  {
    name: "agent.tool.invoke(refund)",
    company: "stripe",
    source: "tool-call",
    dot: "green",
  },
  {
    name: "slack.escalation.queued",
    company: "slack",
    source: "ops-channel",
    dot: "pink",
  },
  {
    name: "trace.score.regressed",
    company: "datadog",
    source: "eval-worker",
    dot: "orange",
  },
  {
    name: "agent.response.streamed",
    company: "openai",
    source: "model-router",
    dot: "violet",
  },
];

function formatTimelineTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function makeLiveTimelineEvent(index: number): DashboardTimelineEvent {
  const template = liveTimelineTemplates[index % liveTimelineTemplates.length]!;
  const latency = 80 + ((index * 137) % 1850);
  return {
    ...template,
    time: formatTimelineTime(new Date()),
    latency: latency > 1000 ? `${(latency / 1000).toFixed(1)}s` : `${latency}ms`,
    live: true,
  };
}

export interface DashboardOverviewProps extends React.HTMLAttributes<HTMLDivElement> {
  data?: DashboardOverviewData;
}

export function DashboardOverview({
  data = dashboardOverviewSeed,
  className,
  ...props
}: DashboardOverviewProps) {
  const [timeline, setTimeline] = React.useState(data.timeline);
  const liveEventIndex = React.useRef(0);

  /* Register the site-header breadcrumb for the overview page. */
  const breadcrumbCrumbs = React.useMemo(
    () => [{ label: "Overview" }],
    []
  );
  useSetSiteBreadcrumb(breadcrumbCrumbs);

  React.useEffect(() => {
    setTimeline(data.timeline);
    liveEventIndex.current = 0;
  }, [data.timeline]);

  React.useEffect(() => {
    const interval = window.setInterval(() => {
      liveEventIndex.current += 1;
      const nextEvent = makeLiveTimelineEvent(liveEventIndex.current);
      setTimeline((current) => [nextEvent, ...current].slice(0, 14));
    }, 2400);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <div
      className={[
        "flex min-h-[calc(100svh-var(--header-height)-2rem)] flex-col gap-4 bg-black text-ink",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      <DashboardHero data={data} />
      <DashboardMetricStrip metrics={data.metrics} />
      <div className="grid flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <LiveTimelinePanel events={timeline} />
        <div className="flex flex-col gap-4">
          <WaitingOnYouPanel items={data.actions} />
          <ValidationPanel runs={data.validation} />
          <ConnectionsPanel connections={data.connections} />
        </div>
      </div>
    </div>
  );
}

function DashboardHero({ data }: { data: DashboardOverviewData }) {
  return (
    <header className="flex flex-col gap-4 border-b border-divider pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 className="font-display text-[34px] font-normal leading-none tracking-[-0.04em] text-ink-hi md:text-[44px]">
          Today’s <em className="font-normal italic text-ember">signal.</em>
        </h1>
        <p className="mt-2 max-w-2xl text-[12.5px] leading-5 text-ink-dim">
          {data.subtitle}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-ink-dim">
          {data.range}
        </span>
        <Button variant="primary" size="sm" className="rounded-sm">
          Run backtest
        </Button>
      </div>
    </header>
  );
}

function DashboardMetricStrip({ metrics }: { metrics: DashboardMetric[] }) {
  return (
    <section className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <article
          key={metric.label}
          className="min-h-[76px] rounded-none border border-divider bg-wash-micro px-4 py-3 shadow-[inset_0_1px_0_var(--c-wash-micro)]"
        >
          <p className="font-mono text-[8.5px] uppercase tracking-[0.17em] text-ink-dim">
            {metric.label}
          </p>
          <p className="mt-2 font-display text-[29px] font-normal leading-none tracking-[-0.04em] text-ink-hi">
            {metric.value}
          </p>
          <p
            className={[
              "mt-1 font-mono text-[8.5px] uppercase tracking-[0.1em]",
              metricToneClass[metric.tone ?? "default"],
            ].join(" ")}
          >
            {metric.delta}
          </p>
        </article>
      ))}
    </section>
  );
}

function Panel({
  title,
  eyebrow,
  action,
  children,
  className,
}: {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={[
        "rounded-[2px] border border-divider bg-wash-micro p-4 shadow-[inset_0_1px_0_var(--c-wash-micro)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-[18px] font-normal leading-none tracking-[-0.03em] text-ink-hi">
            {title}
          </h2>
          {eyebrow ? <p className="mt-1 text-xs text-ink-dim">{eyebrow}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function LiveTimelinePanel({ events }: { events: DashboardTimelineEvent[] }) {
  return (
    <Panel
      title="Live timeline"
      eyebrow="Streaming provider events · updates every few seconds"
      className="min-h-[560px]"
      action={
        <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.14em]">
          <StatusDot variant="green" pulse />
          <span className="text-event-green">Live</span>
          <span className="text-ember">Open timeline +</span>
        </div>
      }
    >
      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_170px]">
        <div className="space-y-3">
          {events.map((event) => (
            <div
              key={`${event.time}-${event.name}`}
              className={[
                "grid grid-cols-[74px_22px_minmax(0,1fr)] items-center gap-2 font-mono text-[10.5px] transition-colors duration-500",
                event.live ? "text-ink-hi" : "text-ink-lo",
              ].join(" ")}
            >
              <span className="text-ink-dim">{event.time}</span>
              <CompanyLogo
                name={event.company}
                size={16}
                radius={4}
                fallbackBackground="var(--c-surface-02)"
                fallbackColor="var(--c-ink-dim)"
              />
              <span className="truncate tracking-[0.04em]">
                {event.name}
                {event.live ? (
                  <span className="ml-2 rounded-[2px] bg-event-green/10 px-1.5 py-[1px] text-[9px] uppercase tracking-[0.12em] text-event-green">
                    new
                  </span>
                ) : null}
              </span>
            </div>
          ))}
        </div>
        <div className="hidden border-l border-hairline pl-4 font-mono text-[10px] lg:block">
          {events.slice(0, 6).map((event) => (
            <div
              key={`${event.source}-${event.latency}`}
              className="mb-3 flex items-center justify-between gap-3"
            >
              <span
                className={[
                  "truncate",
                  event.dot === "red" || event.dot === "orange"
                    ? "text-ember"
                    : "text-ink-dim",
                ].join(" ")}
              >
                {event.source}
              </span>
              <span className="shrink-0 text-ink-dim">{event.latency}</span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function WaitingOnYouPanel({ items }: { items: DashboardActionItem[] }) {
  return (
    <Panel
      title="Waiting on you"
      action={
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-dim">
          {items.length} items
        </span>
      }
    >
      <div className="space-y-2">
        {items.map((item) => (
          <button
            key={`${item.tone}-${item.detail}`}
            type="button"
            className={[
              "flex w-full items-center gap-3 rounded-[2px] border px-3 py-2 text-left transition-colors hover:bg-wash-2",
              actionToneClass[item.tone],
            ].join(" ")}
          >
            <span className="font-mono text-[9px] uppercase tracking-[0.12em]">
              {item.label}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs text-ink-lo">{item.detail}</span>
            <span className="text-ink-dim">+</span>
          </button>
        ))}
      </div>
    </Panel>
  );
}

function ValidationPanel({ runs }: { runs: DashboardValidationRun[] }) {
  return (
    <Panel
      title="Validation"
      action={<span className="font-mono text-[9px] uppercase text-ink-dim">All +</span>}
    >
      <div className="space-y-4">
        {runs.map((run) => (
          <div key={run.label}>
            <div className="mb-2 flex items-center justify-between font-mono text-[10px]">
              <span className="text-ink-dim">{run.label}</span>
              <span className={run.tone === "green" ? "text-event-green" : "text-event-red"}>
                {run.score}
              </span>
            </div>
            <div className="h-[6px] overflow-hidden rounded-full bg-surface-03">
              <div
                className={[
                  "h-full rounded-full",
                  run.tone === "green" ? "bg-event-green" : "bg-ember",
                ].join(" ")}
                style={{ width: `${Math.max(0, Math.min(run.value, 100))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ConnectionsPanel({ connections }: { connections: DashboardConnection[] }) {
  return (
    <Panel
      title="Connections"
      action={
        <a
          href="/dashboard/connections"
          className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
        >
          Manage +
        </a>
      }
    >
      <div className="space-y-2">
        {connections.map((connection) => (
          <div
            key={connection.name}
            className="flex items-center justify-between gap-3 rounded-[2px] border border-divider bg-black px-3 py-2"
          >
            <span className="flex items-center gap-2 text-xs text-ink-lo">
              <CompanyLogo
                name={connection.name}
                domain={connection.domain}
                size={14}
                radius={3}
                fallbackBackground="var(--c-surface-02)"
                fallbackColor="var(--c-ink-dim)"
              />
              {connection.name}
            </span>
            <span
              className={[
                "font-mono text-[10px] uppercase tracking-[0.12em]",
                connection.state === "ok" ? "text-event-green" : "text-event-amber",
              ].join(" ")}
            >
              {connection.state}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
