import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

import { AppShell } from "../../layout/app-shell";
import { TopBar } from "../../layout/top-bar";
import { FilterBar } from "../../layout/filter-bar";
import { GroupHead } from "../../layout/group-head";
import { Button } from "../../primitives/button";
import { FilterPill } from "../../primitives/filter-pill";
import { Priority } from "../../primitives/priority";
import { Status } from "../../primitives/status";
import { TraceRow } from "../../product/trace-row";
import { Minimap, generateMinimapBars } from "../../product/minimap";

import {
  SOURCES,
  TRACES,
  groupByStatus,
  type DemoTrace,
} from "./_timeline-data";

/**
 * Templates / Timeline — full Linear-density Chronicle Timeline app
 * built from the new `--l-*` density layer. Demonstrates:
 *
 *   - workspace switcher + sectioned sidebar with per-source counts
 *   - 44 px topbar (crumbs + Live + time selector + ⌘K trigger)
 *   - 40 px filter bar (verb pills + Clear + Display + count)
 *   - draggable compact minimap with bins + ruler + shaded rest-of-track
 *   - sticky GroupHead per status with a count
 *   - Linear-style TraceRow with priority glyph, IDs, sub-meta,
 *     colored event spans, trailing meta, and assignee avatar
 *   - InspectorDrawer overlay with field stack + footer actions
 *
 * Selecting a row pops the inspector. Selecting a sidebar source
 * scopes the visible trace list. Filter pill × clears that filter.
 *
 * Ported (heavily condensed) from the design-system zip's
 * `timeline/Timeline*.jsx` runtime prototypes.
 */
function TimelineApp() {
  const [activeSources, setActiveSources] = React.useState<Set<string>>(
    new Set(SOURCES.map((s) => s.id))
  );
  const [outcomeFilter, setOutcomeFilter] = React.useState<
    "any" | "fail" | "pass" | "partial"
  >("any");
  const [priorityFilter, setPriorityFilter] = React.useState<
    "any" | "urgent" | "high"
  >("any");
  const [selectedId, setSelectedId] = React.useState<string | null>("CHR-1284");
  const [win, setWin] = React.useState<[number, number]>([0.32, 0.68]);

  const filtered = React.useMemo(() => {
    return TRACES.filter((t) => {
      if (outcomeFilter !== "any" && t.outcome !== outcomeFilter) return false;
      if (priorityFilter === "urgent" && t.priority !== "urgent") return false;
      if (priorityFilter === "high" && t.priority !== "high") return false;
      return true;
    });
  }, [outcomeFilter, priorityFilter]);

  // Selected trace lookup.
  const selected = React.useMemo<DemoTrace | null>(
    () => TRACES.find((t) => t.id === selectedId) ?? null,
    [selectedId]
  );

  const groups = React.useMemo(() => groupByStatus(filtered), [filtered]);

  const ruler = React.useMemo(
    () => ["13:00", "13:10", "13:20", "13:30", "13:40", "13:50", "14:00"],
    []
  );

  const toggleSource = (id: string) => {
    setActiveSources((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sectionHead = (label: string) => (
    <div className="px-s-3 pt-s-3 pb-[4px] font-mono text-[10.5px] uppercase tracking-eyebrow text-l-ink-dim">
      {label}
    </div>
  );

  const sidebarItem = (
    label: React.ReactNode,
    {
      count,
      active,
      color,
      onClick,
      key,
    }: {
      count?: React.ReactNode;
      active?: boolean;
      color?: string;
      onClick?: () => void;
      key?: string;
    } = {}
  ) => (
    <div
      key={key}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={
        "relative flex h-[26px] items-center gap-s-2 rounded-l px-s-3 font-sans text-[13px] cursor-pointer outline-none " +
        "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember " +
        (active
          ? "bg-l-surface-selected text-l-ink before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-[14px] before:w-[2px] before:bg-ember before:rounded-r-sm"
          : "text-l-ink-lo hover:bg-l-wash-3 hover:text-l-ink")
      }
    >
      <span
        className="h-[6px] w-[6px] rounded-pill"
        style={{
          background: color ?? "currentColor",
          opacity: color ? 1 : 0.5,
        }}
      />
      <span className="flex-1">{label}</span>
      {count !== undefined ? (
        <span className="font-mono text-[11px] text-l-ink-dim">{count}</span>
      ) : null}
    </div>
  );

  const sidebar = (
    <nav className="flex flex-col p-s-2">
      <div className="flex items-center gap-s-2 px-s-2 py-[6px]">
        <span className="flex h-[22px] w-[22px] items-center justify-center rounded-l-sm bg-ember font-display text-[12px] font-semibold text-white">
          C
        </span>
        <span className="text-[13px] font-medium text-l-ink">Chronicle</span>
      </div>
      {sectionHead("Workspace")}
      {sidebarItem("Inbox", { count: 12, key: "inbox" })}
      {sidebarItem("Timeline", { active: true, key: "timeline" })}
      {sidebarItem("Saved views", { key: "saved" })}
      {sectionHead("Saved filters")}
      {sidebarItem("Divergences", { count: 2, key: "f1" })}
      {sidebarItem("Urgent + Failed", { count: 3, key: "f2" })}
      {sidebarItem("Enterprise", { count: 2, key: "f3" })}
      {sectionHead("Sources")}
      {SOURCES.map((s) =>
        sidebarItem(s.label, {
          key: `src-${s.id}`,
          count: s.count,
          color: activeSources.has(s.id) ? s.color : "var(--l-ink-dim)",
          onClick: () => toggleSource(s.id),
        })
      )}
    </nav>
  );

  const topBar = (
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

  const filterBar = (
    <FilterBar>
      {outcomeFilter !== "any" ? (
        <FilterPill
          icon={<TriangleIcon />}
          dimension="Outcome"
          value={
            outcomeFilter === "fail"
              ? "Failed"
              : outcomeFilter === "pass"
                ? "Resolved"
                : "Partial"
          }
          onRemove={() => setOutcomeFilter("any")}
        />
      ) : null}
      {priorityFilter !== "any" ? (
        <FilterPill
          icon={<BoltIcon />}
          dimension="Priority"
          value={priorityFilter === "urgent" ? "Urgent" : "High"}
          onRemove={() => setPriorityFilter("any")}
        />
      ) : null}
      <FilterBar.AddFilter
        label={
          outcomeFilter === "any" && priorityFilter === "any" ? "Filter" : ""
        }
      />
      {outcomeFilter !== "any" || priorityFilter !== "any" ? (
        <FilterBar.Clear
          onClick={() => {
            setOutcomeFilter("any");
            setPriorityFilter("any");
          }}
        />
      ) : null}
      <FilterBar.Divider />
      <FilterBar.Display />
      <FilterBar.Spacer />
      <FilterBar.Count
        shown={filtered.length}
        total={TRACES.length}
        unit="traces"
      />
    </FilterBar>
  );

  const detailPanel = (
    <aside className="flex h-full flex-col bg-l-surface-raised">
      {selected ? (
        <>
          <div className="border-b border-l-border-faint px-s-4 py-s-3">
            <div className="font-mono text-[10.5px] uppercase tracking-eyebrow text-l-ink-dim">
              {selected.id} · Trace
            </div>
            <h3 className="mt-[6px] font-display text-[20px] font-medium leading-tight text-l-ink">
              {selected.title}
            </h3>
          </div>
          <div className="flex-1 overflow-auto px-s-4 py-s-3">
            <DetailField label="Status">
              <Status kind={selected.status} />
              {capitalize(selected.outcome)}
            </DetailField>
            <DetailField label="Priority">
              <Priority level={selected.priority} />
              {capitalize(selected.priority)}
            </DetailField>
            <DetailField label="Customer">
              <AvatarBubble initials={selected.customerInitials} />
              {selected.customer}
            </DetailField>
            <DetailField label="Region">{selected.region}</DetailField>
            <DetailField label="Duration">
              {fmtDuration(selected.durationMs)}
            </DetailField>
          </div>
          <div className="flex items-center gap-s-2 border-t border-l-border-faint px-s-4 py-s-3">
            <Button variant="secondary" size="sm">
              Open trace
            </Button>
            <Button variant="primary" size="sm">
              Run replay
            </Button>
          </div>
        </>
      ) : (
        <div className="flex h-full flex-col justify-center px-s-5 text-[13px] text-l-ink-lo">
          <div className="font-display text-[18px] font-medium text-l-ink">
            Select a trace
          </div>
          <p className="mt-s-2 max-w-[28ch]">
            Pick a row to inspect replay status, priority, customer, and timing.
          </p>
        </div>
      )}
    </aside>
  );

  return (
    <AppShell
      style={{ height: "100vh" }}
      topbar={topBar}
      filterBar={filterBar}
      nav={sidebar}
      detail={detailPanel}
      detailWidth={360}
    >
      <div className="relative flex h-full flex-col overflow-hidden bg-l-surface">
        <Minimap
          density="compact"
          bars={generateMinimapBars(80)}
          window={win}
          onWindowChange={setWin}
          rulerLabels={ruler}
          readoutLeft={`Timeline · 60 min · ${TRACES.length} traces · 45 events`}
          readoutRight="Drag the window to zoom"
        />
        <div className="flex-1 overflow-auto">
          {groups.map((g) => (
            <React.Fragment key={g.status}>
              <GroupHead>
                <Status kind={g.status} />
                <span>{g.label}</span>
                <GroupHead.Count>{g.traces.length}</GroupHead.Count>
              </GroupHead>
              {g.traces.map((t) => (
                <TraceRow
                  key={t.id}
                  id={t.id}
                  title={t.title}
                  subMeta={t.subMeta}
                  priority={t.priority}
                  events={t.events}
                  meta={fmtDuration(t.durationMs)}
                  assignee={t.customerInitials}
                  selected={selectedId === t.id}
                  onSelect={() =>
                    setSelectedId((cur) => (cur === t.id ? null : t.id))
                  }
                />
              ))}
            </React.Fragment>
          ))}
          <div className="px-s-5 py-s-4 text-[12px] text-l-ink-dim">
            {filtered.length === 0
              ? "No traces match the current filters."
              : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r === 0 ? `${m}m` : `${m}m ${r}s`;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function AvatarBubble({ initials }: { initials: string }) {
  return (
    <span
      className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-pill font-mono text-[9px] font-semibold text-white"
      style={{ background: "linear-gradient(135deg, #709188, #3e547c)" }}
    >
      {initials}
    </span>
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

const meta: Meta = {
  title: "Templates/Timeline",
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj;

export const Canvas: Story = { render: () => <TimelineApp /> };
