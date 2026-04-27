import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

import { AppShell } from "../../layout/app-shell";
import { ChronHeader } from "../../layout/chron-header";
import { FilterBar } from "../../layout/filter-bar";
import { GroupHead } from "../../layout/group-head";
import { PageHeader } from "../../layout/page-header";
import { TopBar } from "../../layout/top-bar";
import { Button } from "../../primitives/button";
import { Eyebrow } from "../../primitives/eyebrow";
import { FilterPill } from "../../primitives/filter-pill";
import { Priority } from "../../primitives/priority";
import { Status } from "../../primitives/status";
import { StatusDot } from "../../primitives/status-dot";
import { EventStream, type EventStreamItem } from "../../product/event-stream";
import { Minimap, generateMinimapBars } from "../../product/minimap";
import { TraceRow } from "../../product/trace-row";
import { Display } from "../../typography/display";
import { Mono } from "../../typography/mono";

const items: EventStreamItem[] = [
  {
    id: "1",
    time: "14:04:41",
    lane: "teal",
    topic: "support.conversation",
    verb: "created",
    preview:
      '"My last order never arrived. It&apos;s been almost two weeks." — Sarah Chen',
    source: "intercom",
  },
  {
    id: "2",
    time: "14:06:02",
    lane: "amber",
    topic: "shopify.order",
    verb: "lookup",
    preview:
      '{ order_id: "8821", status: "delivered", delivered_at: "2026-02-12T16:22Z" }',
    source: "shopify",
  },
  {
    id: "3",
    time: "14:06:41",
    lane: "green",
    topic: "agent.response",
    verb: "generated",
    preview:
      '"Your order was delivered last Thursday. Can you confirm the shipping address?"',
    source: "support-ai",
  },
  {
    id: "4",
    time: "14:09:18",
    lane: "teal",
    topic: "support.message",
    verb: "received",
    preview: "\"The address is wrong. Says 'Main St' but I live on Maine St.\"",
    source: "intercom",
  },
  {
    id: "5",
    time: "14:09:41",
    lane: "orange",
    topic: "ops.alert",
    verb: "triggered",
    preview:
      "sentiment_drop detected · customer_health: 0.82 → 0.31 over 3 turns",
    source: "ops",
  },
  {
    id: "6",
    time: "14:10:02",
    lane: "pink",
    topic: "agent.tool.invoke → escalate",
    preview:
      "Handing off to human agent · reason: shipping_error · tier: priority",
    source: "support-ai",
  },
  {
    id: "7",
    time: "14:10:22",
    lane: "pink",
    topic: "slack.channel",
    verb: "post",
    preview: "#shipping-issues · new priority escalation from support-ai",
    source: "slack",
  },
  {
    id: "8",
    time: "14:11:08",
    lane: "green",
    topic: "stripe.refund",
    verb: "created",
    preview: "re_3Nf8q2L · $84.00 · order_id=8821 · initiated_by=agent_maria",
    source: "stripe",
  },
];

// ─────────────────────────────────────────────────────────────
// "Linear" — the new compact-density product surface (default)
// ─────────────────────────────────────────────────────────────

const FilterIcon = () => (
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

function LinearNav() {
  const navRow = (
    label: string,
    count?: string | number,
    active?: boolean,
    color?: string
  ) => (
    <div
      key={label}
      className={
        "relative flex h-[26px] items-center gap-s-2 rounded-l px-s-3 font-sans text-[13px] " +
        (active
          ? "bg-l-surface-selected text-l-ink before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-[14px] before:w-[2px] before:bg-ember before:rounded-r-sm"
          : "text-l-ink-lo hover:bg-l-wash-3 hover:text-l-ink")
      }
    >
      <span
        className="h-[6px] w-[6px] rounded-pill"
        style={{ background: color ?? "currentColor", opacity: 0.7 }}
      />
      <span className="flex-1">{label}</span>
      {count !== undefined ? (
        <span className="font-mono text-[11px] text-l-ink-dim">{count}</span>
      ) : null}
    </div>
  );

  const sectionHead = (label: string) => (
    <div
      key={label}
      className="px-s-3 pt-s-3 pb-[4px] font-mono text-[10.5px] uppercase tracking-eyebrow text-l-ink-dim"
    >
      {label}
    </div>
  );

  return (
    <nav className="flex flex-col p-s-2">
      <div className="flex items-center gap-s-2 px-s-2 py-[6px]">
        <span className="flex h-[22px] w-[22px] items-center justify-center rounded-l-sm bg-ember font-display text-[12px] font-semibold text-white">
          C
        </span>
        <span className="text-[13px] font-medium text-l-ink">Chronicle</span>
      </div>
      {sectionHead("Workspace")}
      {navRow("Inbox", 12)}
      {navRow("Timeline", undefined, true)}
      {navRow("Saved views")}
      {sectionHead("Sources")}
      {navRow("intercom", 412, false, "var(--c-event-teal)")}
      {navRow("shopify", 308, false, "var(--c-event-amber)")}
      {navRow("stripe", 221, false, "var(--c-event-green)")}
      {navRow("ops", 89, false, "var(--c-event-orange)")}
      {navRow("slack", 140, false, "var(--c-event-pink)")}
    </nav>
  );
}

function LinearTopBar() {
  return (
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
  );
}

function LinearFilterBar() {
  return (
    <FilterBar>
      <FilterPill
        icon={<FilterIcon />}
        dimension="Outcome"
        value="Failed"
        onRemove={() => {}}
      />
      <FilterPill
        icon={<BoltIcon />}
        dimension="Priority"
        value="Urgent, High"
        onRemove={() => {}}
      />
      <FilterBar.AddFilter label="" />
      <FilterBar.Clear />
      <FilterBar.Divider />
      <FilterBar.Display />
      <FilterBar.Spacer />
      <FilterBar.Count shown={8} total={42} unit="traces" />
    </FilterBar>
  );
}

function LinearInspector() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-l-border-faint px-s-4 py-s-3">
        <div className="font-mono text-[10.5px] uppercase tracking-eyebrow text-l-ink-dim">
          CHR-1284 · TRACE
        </div>
        <h3 className="mt-[6px] font-display text-[20px] font-medium leading-tight text-l-ink">
          Refund · wrong shipping address
        </h3>
      </div>
      <div className="flex-1 overflow-auto px-s-4 py-s-3 text-[13px]">
        <div className="grid grid-cols-[80px_1fr] items-center gap-y-s-2">
          <span className="text-l-ink-lo">Status</span>
          <span className="flex items-center gap-s-2 text-l-ink">
            <Status kind="canceled" /> Failed
          </span>
          <span className="text-l-ink-lo">Priority</span>
          <span className="flex items-center gap-s-2 text-l-ink">
            <Priority level="urgent" /> Urgent
          </span>
          <span className="text-l-ink-lo">Customer</span>
          <span className="text-l-ink">Sarah Chen</span>
          <span className="text-l-ink-lo">Region</span>
          <span className="text-l-ink">EU</span>
          <span className="text-l-ink-lo">Started</span>
          <span className="font-mono text-l-ink">14:55:12</span>
          <span className="text-l-ink-lo">Duration</span>
          <span className="font-mono text-l-ink">3m 18s</span>
        </div>
      </div>
      <div className="flex items-center gap-s-2 border-t border-l-border-faint px-s-4 py-s-3">
        <Button variant="secondary" size="sm">
          Open trace
        </Button>
        <Button variant="primary" size="sm">
          Run replay
        </Button>
      </div>
    </div>
  );
}

function LinearTimeline() {
  const [win, setWin] = React.useState<[number, number]>([0.32, 0.68]);
  const ruler = ["13:00", "13:10", "13:20", "13:30", "13:40", "13:50", "14:00"];
  return (
    <AppShell
      topbar={<LinearTopBar />}
      filterBar={<LinearFilterBar />}
      nav={<LinearNav />}
      detail={<LinearInspector />}
      style={{ height: "100vh" }}
    >
      <div className="flex flex-col">
        <Minimap
          density="compact"
          bars={generateMinimapBars(80)}
          window={win}
          onWindowChange={setWin}
          rulerLabels={ruler}
          readoutLeft="Timeline · 60 min · 8 traces · 45 events"
          readoutRight="Drag the window to zoom"
        />
        <GroupHead>
          <Status kind="inprogress" />
          <span>In progress</span>
          <GroupHead.Count>4</GroupHead.Count>
        </GroupHead>
        <TraceRow
          id="CHR-1285"
          priority="high"
          title="Bulk import · v"
          subMeta="14:55 · 3m 18s"
          events={[{ lane: "teal" }, { lane: "violet" }]}
          meta="3m 18s"
          assignee="GX"
        />
        <TraceRow
          id="CHR-1278"
          priority="med"
          title="p95 latency spike · ticket-fetch"
          subMeta="14:48 · 3m 48s"
          events={[{ lane: "orange", weight: 2 }, { lane: "orange" }]}
          meta="3m 48s"
          assignee="SYS"
        />
        <TraceRow
          id="CHR-1284"
          priority="urgent"
          title="Refund · wrong shipping address"
          subMeta="Sarah Chen · EU"
          events={[
            { lane: "teal" },
            { lane: "amber" },
            { lane: "green" },
            { lane: "ember", weight: 2 },
            { lane: "pink" },
            { lane: "green" },
          ]}
          meta="Failed"
          assignee="SC"
          selected
        />
      </div>
    </AppShell>
  );
}

// ─────────────────────────────────────────────────────────────
// "Original" — the brand-density bordered shell (kept for one
// release as a migration reference; matches the previous Canvas
// story exactly via density="brand").
// ─────────────────────────────────────────────────────────────

function NavItem({
  children,
  lane,
  count,
  active = false,
}: {
  children: React.ReactNode;
  lane?: React.ComponentProps<typeof StatusDot>["variant"];
  count?: React.ReactNode;
  active?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-s-3 rounded-xs px-s-3 py-s-2 font-mono text-mono ${active ? "bg-surface-03 text-ink-hi" : "text-ink-lo"}`}
    >
      <StatusDot variant={lane ?? "offline"} className="opacity-100" />
      <span>{children}</span>
      {count ? (
        <span className="ml-auto text-mono-sm text-ink-dim">{count}</span>
      ) : null}
    </div>
  );
}

function OriginalTopBar() {
  return (
    <>
      <span className="flex items-center gap-s-2 px-s-2 font-display text-[13px] text-ink-hi">
        <span
          className="h-[6px] w-[6px] rounded-full"
          style={{ background: "var(--grad-lightsource)" }}
        />
        Chronicle
      </span>
      <Mono size="md" tone="dim" tactical className="flex items-center gap-s-3">
        <span>support-agent-v3</span>
        <span className="text-ink-dim">/</span>
        <b className="text-ink-lo font-normal">Live stream</b>
        <span className="text-ink-dim">/</span>
        <span>trace_9f8a22</span>
      </Mono>
      <div className="ml-auto flex items-center gap-s-4">
        <span className="chron-status-live">LIVE · 1,248 ev/s</span>
        <Button density="brand" variant="secondary" size="sm">
          Pause capture
        </Button>
        <Button density="brand" variant="primary" size="sm">
          ▶ Run replay
        </Button>
        <div
          className="h-[28px] w-[28px] rounded-full"
          style={{ background: "var(--grad-lightsource-45)" }}
        />
      </div>
    </>
  );
}

function OriginalNav() {
  return (
    <div className="flex flex-col gap-s-3">
      <Eyebrow className="px-s-3">Workspace</Eyebrow>
      <NavItem>Overview</NavItem>
      <NavItem active count="12.8k">
        Event stream
      </NavItem>
      <NavItem count="24">Replay suite</NavItem>
      <NavItem count={<span className="text-event-red">2</span>}>
        Divergences
      </NavItem>
      <NavItem count="8">Scenarios</NavItem>
      <Eyebrow className="mt-s-5 px-s-3">Streams</Eyebrow>
      <NavItem lane="teal" count="412">
        intercom
      </NavItem>
      <NavItem lane="amber" count="308">
        shopify
      </NavItem>
      <NavItem lane="green" count="221">
        stripe
      </NavItem>
      <NavItem lane="orange" count="89">
        ops
      </NavItem>
      <NavItem lane="pink" count="140">
        slack
      </NavItem>
      <NavItem lane="violet" count="18">
        sandbox
      </NavItem>
    </div>
  );
}

function OriginalDetail() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-hairline p-s-5">
        <Eyebrow className="mb-s-2 block">EVENT · agent.tool.invoke</Eyebrow>
        <Display size="sm" muted={false}>
          escalate(
          <em className="italic font-normal text-ember">
            &ldquo;shipping_error&rdquo;
          </em>
          )
        </Display>
        <div className="mt-s-4 flex flex-wrap gap-s-4">
          {[
            ["at", "14:10:02.418"],
            ["source", "support-ai"],
            ["trace", "cus_demo_01"],
            ["version", "v3.0.4"],
          ].map(([k, v]) => (
            <Mono key={k} size="sm" tactical uppercase tone="dim">
              {k} <b className="text-ink-lo font-normal">{v}</b>
            </Mono>
          ))}
        </div>
      </div>
      <nav className="flex gap-s-6 border-b border-hairline px-s-5">
        {["Trace", "Payload", "Causality", "Diff"].map((t, i) => (
          <button
            key={t}
            className={`py-s-3 font-mono text-mono uppercase tracking-tactical ${i === 0 ? "border-b border-ember text-ink-hi" : "text-ink-dim"} border-b`}
          >
            {t}
          </button>
        ))}
      </nav>
      <div className="flex-1 overflow-auto p-s-5">
        <pre className="m-0 whitespace-pre-wrap rounded-xs border border-hairline bg-surface-00 p-s-4 font-mono text-[11.5px] leading-[1.7] text-ink-lo">
          {`// resolved context at call-site
{
  "tool": "escalate",
  "args": {
    "reason": "shipping_error",
    "tier": "priority",
    "trace_id": "cus_demo_01"
  },
  "prompt_tokens": 1842,
  "emitted_by": support-agent-v3.reasoner
}`}
        </pre>
      </div>
    </div>
  );
}

function OriginalPage06() {
  const [sel, setSel] = React.useState("6");
  const [playing, setPlaying] = React.useState(false);

  return (
    <div className="min-h-screen bg-page">
      <ChronHeader />
      <div className="px-[72px] pb-[80px] pt-[16px] text-ink">
        <PageHeader
          eyebrow="06 / 07"
          title="Product — Event Stream"
          lede="The core surface. Heterogeneous events from every source land on one rail, colored by stream. Selecting an event opens the full causal trace on the right."
        />
        <AppShell
          density="brand"
          topbar={<OriginalTopBar />}
          nav={<OriginalNav />}
          detail={<OriginalDetail />}
          footer={
            <Minimap
              bars={generateMinimapBars()}
              playhead={38}
              range={[22, 56]}
              onPlay={() => setPlaying((p) => !p)}
              playing={playing}
              readoutLeft={
                <>
                  Replay ·{" "}
                  <b className="text-ink-hi font-normal">turn 06 / 11</b>
                </>
              }
              readoutRight={
                <>
                  <b className="text-ink-hi font-normal">14:10:02</b> → 14:12:04
                </>
              }
            />
          }
          style={{ height: 820 }}
        >
          <EventStream
            density="brand"
            items={items}
            selectedId={sel}
            onSelect={setSel}
            daySeparator="Today · Feb 18 2026"
          />
        </AppShell>
      </div>
    </div>
  );
}

const meta: Meta = {
  title: "Templates/Page 06 — Event Stream",
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj;

/** New default — Linear-density timeline from the design-system update. */
export const Linear: Story = { render: () => <LinearTimeline /> };

/** Previous bordered-card shell. Kept for one release as a migration
 * reference. */
export const Original: Story = { render: () => <OriginalPage06 /> };

/** Back-compat alias for the previous story id (`templates-page-06-event-stream--canvas`). */
export const Canvas: Story = Original;
