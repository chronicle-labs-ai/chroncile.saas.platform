import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

import { AppShell } from "./app-shell";
import { TopBar } from "./top-bar";
import { FilterBar } from "./filter-bar";
import { GroupHead } from "./group-head";
import { Sidebar } from "./sidebar";
import { FilterPill } from "../primitives/filter-pill";
import { Status } from "../primitives/status";
import { Priority } from "../primitives/priority";

const meta: Meta<typeof AppShell> = {
  title: "Layout/AppShell",
  component: AppShell,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof AppShell>;

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

const navItem = (label: string, count?: string | number, active?: boolean) => (
  <div
    key={label}
    className={
      "relative flex h-[26px] items-center gap-s-2 rounded-l px-s-3 font-sans text-[13px] " +
      (active
        ? "bg-l-surface-selected text-l-ink before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-[14px] before:w-[2px] before:bg-ember before:rounded-r-sm"
        : "text-l-ink-lo hover:bg-l-wash-3 hover:text-l-ink")
    }
  >
    <span className="h-[6px] w-[6px] rounded-pill bg-current opacity-50" />
    <span className="flex-1">{label}</span>
    {count ? (
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

export const Compact: Story = {
  render: () => (
    <div className="h-screen w-screen">
      <AppShell
        style={{ height: "100vh" }}
        topbar={
          <TopBar>
            <TopBar.Crumb>
              Chronicle <TopBar.CrumbSep /> support-agent
              <TopBar.CrumbSep />
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
            <FilterPill
              icon={<FilterIcon />}
              dimension="Outcome"
              value="Failed"
              onRemove={() => {}}
            />
            <FilterPill
              icon={<FilterIcon />}
              dimension="Priority"
              value="Urgent, High"
              onRemove={() => {}}
            />
            <FilterBar.AddFilter />
            <FilterBar.Divider />
            <FilterBar.Display />
            <FilterBar.Spacer />
            <FilterBar.Count shown={8} total={42} unit="traces" />
          </FilterBar>
        }
        nav={
          <nav className="flex flex-col p-s-2">
            <div className="flex items-center gap-s-2 px-s-2 py-[6px]">
              <span className="flex h-[22px] w-[22px] items-center justify-center rounded-l-sm bg-ember font-display text-[12px] font-semibold text-white">
                C
              </span>
              <span className="text-[13px] font-medium text-l-ink">
                Chronicle
              </span>
            </div>
            {sectionHead("Workspace")}
            {navItem("Inbox", 12)}
            {navItem("Timeline", undefined, true)}
            {navItem("Saved views")}
            {sectionHead("Sources")}
            {navItem("intercom", 412)}
            {navItem("shopify", 308)}
            {navItem("stripe", 221)}
          </nav>
        }
        detail={
          <div className="flex flex-col gap-s-3 p-s-4 text-[13px]">
            <div className="font-mono text-[10.5px] uppercase tracking-eyebrow text-l-ink-dim">
              CHR-1284 · TRACE
            </div>
            <h3 className="font-display text-[20px] font-medium leading-tight text-l-ink">
              Refund · wrong shipping address
            </h3>
            <div className="mt-s-2 grid grid-cols-[80px_1fr] gap-y-s-2 text-l-ink-lo">
              <span>Status</span>
              <span className="flex items-center gap-s-2">
                <Status kind="canceled" /> Failed
              </span>
              <span>Priority</span>
              <span className="flex items-center gap-s-2">
                <Priority level="urgent" /> Urgent
              </span>
              <span>Customer</span>
              <span>Sarah Chen</span>
            </div>
          </div>
        }
      >
        <div className="flex flex-col">
          <GroupHead>
            <Status kind="inprogress" />
            <span>In progress</span>
            <GroupHead.Count>4</GroupHead.Count>
          </GroupHead>
          <div className="px-s-4 py-s-2 text-[13px] text-l-ink">
            Trace lane content placeholder…
          </div>
        </div>
      </AppShell>
    </div>
  ),
};

export const Brand: Story = {
  render: () => (
    <div className="p-s-10">
      <AppShell
        density="brand"
        style={{ height: 720 }}
        topbar={
          <>
            <span className="font-display text-[13px] text-ink-hi">
              Chronicle
            </span>
            <span className="font-mono text-mono text-ink-dim">
              support-agent-v3 /{" "}
              <b className="text-ink-lo font-normal">Live stream</b>
            </span>
          </>
        }
        nav={
          <div className="flex flex-col gap-s-2 font-mono text-mono text-ink-lo">
            <span>Overview</span>
            <span className="text-ink-hi">Event stream</span>
            <span>Replay suite</span>
          </div>
        }
        detail={
          <div className="p-s-5">
            <div className="font-mono text-mono uppercase tracking-eyebrow text-ink-dim">
              EVENT
            </div>
            <div className="mt-s-2 font-display text-title-sm text-ink-hi">
              escalate(shipping_error)
            </div>
          </div>
        }
      >
        <div className="flex-1 p-s-5 font-mono text-mono text-ink-lo">
          Event stream area
        </div>
      </AppShell>
    </div>
  ),
};

// Legacy alias kept so the previous Storybook URL still resolves.
export const ThreeColumn: Story = Brand;

// Sidebar embedded as the nav slot, demonstrating compact density end-to-end
export const SidebarCompact: Story = {
  render: () => (
    <div className="h-screen">
      <AppShell
        style={{ height: "100vh" }}
        topbar={
          <TopBar>
            <TopBar.Crumb>
              Chronicle <TopBar.CrumbSep /> support-agent <TopBar.CrumbSep />
              <TopBar.CrumbActive>Timeline</TopBar.CrumbActive>
            </TopBar.Crumb>
            <TopBar.Spacer />
            <TopBar.Live on />
            <TopBar.SearchTrigger />
          </TopBar>
        }
        nav={
          <Sidebar variant="static" width="md">
            <Sidebar.Header>
              <span className="flex h-[22px] w-[22px] items-center justify-center rounded-l-sm bg-ember font-display text-[12px] font-semibold text-white">
                C
              </span>
              <span className="ml-s-2 text-[13px] font-medium text-l-ink">
                Chronicle
              </span>
            </Sidebar.Header>
            <Sidebar.Nav aria-label="Main">
              <Sidebar.NavSection title="Workspace">
                <Sidebar.NavItem>Inbox</Sidebar.NavItem>
                <Sidebar.NavItem isActive>Timeline</Sidebar.NavItem>
                <Sidebar.NavItem>Saved views</Sidebar.NavItem>
              </Sidebar.NavSection>
              <Sidebar.NavSection title="Sources">
                <Sidebar.NavItem>intercom</Sidebar.NavItem>
                <Sidebar.NavItem>shopify</Sidebar.NavItem>
                <Sidebar.NavItem>stripe</Sidebar.NavItem>
              </Sidebar.NavSection>
            </Sidebar.Nav>
          </Sidebar>
        }
        detailWidth={0}
      >
        <div className="px-s-4 py-s-2 text-[13px] text-l-ink">
          Trace lane content placeholder…
        </div>
      </AppShell>
    </div>
  ),
};
