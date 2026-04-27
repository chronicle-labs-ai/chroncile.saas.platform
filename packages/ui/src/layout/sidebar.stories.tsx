import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

import {
  Sidebar,
  SidebarHeader,
  SidebarStatus,
  SidebarNav,
  SidebarNavSection,
  SidebarNavItem,
  SidebarMeta,
  SidebarFooter,
  SidebarUserCard,
} from "./sidebar";
import {
  WorkspaceSwitcher,
  type WorkspaceSwitcherEntry,
} from "./workspace-switcher";

const meta: Meta = {
  title: "Layout/Sidebar",
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj;

const icon = (d: string) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    className="h-4 w-4"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

const overviewIcon = icon(
  "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6z"
);
const eventsIcon = icon(
  "M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
);
const runsIcon = icon(
  "M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"
);
const rulesIcon = icon("M6 3.75h12M6 8.25h12M6 12.75h12M6 17.25h8");
const connectionsIcon = icon(
  "M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
);
const settingsIcon = icon(
  "M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
);

const workspaces: WorkspaceSwitcherEntry[] = [
  { id: "acme", name: "Acme Inc", plan: "Pro", avatarTone: "ember" },
  { id: "globex", name: "Globex", plan: "Free", avatarTone: "teal" },
  {
    id: "stark",
    name: "Stark Industries",
    plan: "Enterprise",
    avatarTone: "violet",
  },
];

export const Composed: Story = {
  name: "Full composition (product shell)",
  render: () => {
    const [active, setActive] = React.useState("events");
    const [currentWs, setCurrentWs] = React.useState(workspaces[0]!.id);
    const now = new Date().toLocaleTimeString("en-US", { hour12: false });
    const current =
      workspaces.find((w) => w.id === currentWs) ?? workspaces[0]!;

    return (
      <div className="grid min-h-screen grid-cols-[240px_1fr] bg-page">
        <Sidebar variant="static">
          <SidebarHeader>
            <WorkspaceSwitcher
              current={current}
              workspaces={workspaces}
              onSelect={setCurrentWs}
              onCreate={() => console.log("create workspace")}
              onManage={() => console.log("manage workspaces")}
            />
          </SidebarHeader>

          <SidebarStatus tone="nominal" label="System Nominal" trailing={now} />

          <SidebarNav aria-label="Main">
            <SidebarNavSection title="Workspace">
              <SidebarNavItem
                onPress={() => setActive("overview")}
                isActive={active === "overview"}
                icon={overviewIcon}
              >
                Overview
              </SidebarNavItem>
              <SidebarNavItem
                onPress={() => setActive("events")}
                isActive={active === "events"}
                icon={eventsIcon}
                status="LIVE"
                statusTone="nominal"
              >
                Events
              </SidebarNavItem>
              <SidebarNavItem
                onPress={() => setActive("runs")}
                isActive={active === "runs"}
                icon={runsIcon}
              >
                Runs
              </SidebarNavItem>
              <SidebarNavItem
                onPress={() => setActive("rules")}
                isActive={active === "rules"}
                icon={rulesIcon}
                status="BETA"
                statusTone="ember"
              >
                Rules
              </SidebarNavItem>
            </SidebarNavSection>

            <SidebarNavSection title="Platform" className="mt-s-4">
              <SidebarNavItem
                onPress={() => setActive("connections")}
                isActive={active === "connections"}
                icon={connectionsIcon}
              >
                Connections
              </SidebarNavItem>
              <SidebarNavItem
                onPress={() => setActive("settings")}
                isActive={active === "settings"}
                icon={settingsIcon}
              >
                Settings
              </SidebarNavItem>
            </SidebarNavSection>
          </SidebarNav>

          <SidebarMeta
            title="System info"
            rows={[
              { label: "Version", value: "1.0.0" },
              { label: "Environment", value: "PROD", tone: "nominal" },
              { label: "Status", value: "ONLINE", tone: "nominal" },
            ]}
          />

          <SidebarFooter>
            <SidebarUserCard
              name="Ayman Saleh"
              email="ayman@chroniclelabs.org"
              onSignOut={() => console.log("sign out")}
            />
          </SidebarFooter>
        </Sidebar>

        <main className="p-s-10">
          <div className="font-mono text-mono uppercase tracking-eyebrow text-ember mb-s-2">
            {current.name}
          </div>
          <h1 className="font-display text-title-lg text-ink-hi mb-s-4">
            {active[0]?.toUpperCase() + active.slice(1)}
          </h1>
          <p className="max-w-[60ch] font-sans text-sm text-ink-lo">
            This story mounts the full sidebar compound with a live workspace
            switcher at the top and a live user card at the bottom. Use the
            sidebar to change routes; use the switcher to toggle workspaces.
          </p>
        </main>
      </div>
    );
  },
};

export const JustTheStatusStrip: Story = {
  render: () => (
    <div className="w-[240px] border border-hairline rounded-md overflow-hidden">
      <SidebarStatus
        tone="nominal"
        label="System Nominal"
        trailing="00:42:17"
      />
      <SidebarStatus tone="data" label="Env Manager" trailing="v0.1.0" />
      <SidebarStatus
        tone="caution"
        label="Upgrade available"
        trailing="1.2.0"
      />
      <SidebarStatus tone="critical" label="Outage" trailing="live" />
      <SidebarStatus tone="ember" label="Deploy in progress" trailing="8m" />
      <SidebarStatus tone="neutral" label="Idle" pulse={false} trailing="" />
    </div>
  ),
};

export const JustTheNav: Story = {
  render: () => (
    <div className="w-[240px] bg-surface-01 rounded-md border border-hairline py-s-4">
      <SidebarNav aria-label="Nav only">
        <SidebarNavSection title="Workspace">
          <SidebarNavItem icon={overviewIcon} isActive>
            Overview
          </SidebarNavItem>
          <SidebarNavItem icon={eventsIcon} status="LIVE">
            Events
          </SidebarNavItem>
          <SidebarNavItem icon={runsIcon}>Runs</SidebarNavItem>
        </SidebarNavSection>
      </SidebarNav>
    </div>
  ),
};
