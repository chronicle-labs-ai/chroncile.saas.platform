import type { TraceRowEventSpan } from "../../product/trace-row";
import type { PriorityLevel } from "../../primitives/priority";
import type { StatusKind } from "../../primitives/status";

/**
 * Hand-crafted fixture for the Templates / Timeline story. Mirrors the
 * shape of the design-system zip's `TimelineData.jsx` but pre-aggregated
 * to row-level so the story stays declarative.
 */
export interface DemoTrace {
  id: string;
  title: string;
  subMeta: string;
  priority: PriorityLevel;
  status: StatusKind;
  outcome: "pass" | "partial" | "fail";
  customer: string;
  customerInitials: string;
  region: "US" | "EU" | "APAC" | "global";
  durationMs: number;
  events: TraceRowEventSpan[];
}

export interface DemoSource {
  id: string;
  label: string;
  color: string;
  count: number;
}

export const SOURCES: DemoSource[] = [
  { id: "intercom", label: "intercom", color: "var(--c-event-teal)", count: 412 },
  { id: "shopify", label: "shopify", color: "var(--c-event-amber)", count: 308 },
  { id: "stripe", label: "stripe", color: "var(--c-event-green)", count: 221 },
  { id: "ops", label: "ops", color: "var(--c-event-orange)", count: 89 },
  { id: "slack", label: "slack", color: "var(--c-event-pink)", count: 140 },
  { id: "posthog", label: "posthog", color: "var(--c-event-violet)", count: 18 },
];

export const TRACES: DemoTrace[] = [
  {
    id: "CHR-1284",
    title: "Refund · wrong shipping address",
    subMeta: "Sarah Chen · EU · 14:55",
    priority: "urgent",
    status: "canceled",
    outcome: "fail",
    customer: "Sarah Chen",
    customerInitials: "SC",
    region: "EU",
    durationMs: 198_000,
    events: [
      { lane: "teal" },
      { lane: "amber" },
      { lane: "green" },
      { lane: "ember", weight: 2 },
      { lane: "pink" },
      { lane: "green" },
    ],
  },
  {
    id: "CHR-1285",
    title: "Bulk import · validation failures",
    subMeta: "Globex · 14:55",
    priority: "high",
    status: "inprogress",
    outcome: "partial",
    customer: "Globex",
    customerInitials: "GX",
    region: "US",
    durationMs: 198_000,
    events: [
      { lane: "teal" },
      { lane: "violet" },
      { lane: "red", weight: 2 },
    ],
  },
  {
    id: "CHR-1278",
    title: "p95 latency spike · ticket-fetch",
    subMeta: "ops · 14:48",
    priority: "med",
    status: "inprogress",
    outcome: "partial",
    customer: "Initech",
    customerInitials: "SYS",
    region: "global",
    durationMs: 228_000,
    events: [
      { lane: "orange", weight: 2 },
      { lane: "orange" },
    ],
  },
  {
    id: "CHR-1279",
    title: "SSO redirect loop · Okta",
    subMeta: "Initech · 14:40",
    priority: "med",
    status: "todo",
    outcome: "partial",
    customer: "Initech",
    customerInitials: "IN",
    region: "US",
    durationMs: 320_000,
    events: [{ lane: "violet", weight: 2 }, { lane: "teal" }],
  },
  {
    id: "CHR-1283",
    title: "Chargeback · Acme Corp $2,400",
    subMeta: "Acme Corp · US · 14:30",
    priority: "high",
    status: "done",
    outcome: "pass",
    customer: "Acme Corp",
    customerInitials: "AC",
    region: "US",
    durationMs: 1_500_000,
    events: [
      { lane: "green" },
      { lane: "amber" },
      { lane: "teal" },
      { lane: "green" },
      { lane: "pink" },
    ],
  },
  {
    id: "CHR-1281",
    title: "Double charge · refund issued",
    subMeta: "Sarah Chen · 14:34",
    priority: "high",
    status: "done",
    outcome: "pass",
    customer: "Sarah Chen",
    customerInitials: "SC",
    region: "EU",
    durationMs: 200_000,
    events: [{ lane: "amber" }, { lane: "green" }, { lane: "green" }],
  },
  {
    id: "CHR-1280",
    title: "Out of stock · ship-replace",
    subMeta: "Marco V. · EU · 14:25",
    priority: "low",
    status: "done",
    outcome: "pass",
    customer: "Marco V.",
    customerInitials: "MV",
    region: "EU",
    durationMs: 240_000,
    events: [{ lane: "amber" }, { lane: "amber" }, { lane: "teal" }],
  },
  {
    id: "CHR-1276",
    title: "Self-serve cancellation",
    subMeta: "Priya R. · APAC · 14:18",
    priority: "low",
    status: "done",
    outcome: "pass",
    customer: "Priya R.",
    customerInitials: "PR",
    region: "APAC",
    durationMs: 80_000,
    events: [{ lane: "teal" }, { lane: "green" }],
  },
];

export interface DemoGroup {
  status: StatusKind;
  label: string;
  traces: DemoTrace[];
}

export function groupByStatus(traces: DemoTrace[]): DemoGroup[] {
  const order: StatusKind[] = ["inprogress", "todo", "done", "canceled"];
  const labels: Record<StatusKind, string> = {
    backlog: "Backlog",
    todo: "Todo",
    inprogress: "In progress",
    done: "Done",
    canceled: "Canceled",
  };
  const buckets = new Map<StatusKind, DemoTrace[]>();
  for (const t of traces) {
    if (!buckets.has(t.status)) buckets.set(t.status, []);
    buckets.get(t.status)!.push(t);
  }
  return order
    .filter((k) => buckets.has(k))
    .map((k) => ({ status: k, label: labels[k], traces: buckets.get(k)! }));
}
