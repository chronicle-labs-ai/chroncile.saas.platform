import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

import {
  WorkspaceSwitcher,
  type WorkspaceSwitcherEntry,
} from "./workspace-switcher";

const meta: Meta<typeof WorkspaceSwitcher> = {
  title: "Layout/WorkspaceSwitcher",
  component: WorkspaceSwitcher,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof WorkspaceSwitcher>;

const smallList: WorkspaceSwitcherEntry[] = [
  { id: "acme", name: "Acme Inc", plan: "Pro", avatarTone: "ember" },
  { id: "north", name: "Northwind", plan: "Pro", avatarTone: "teal" },
  { id: "globex", name: "Globex", plan: "Free", avatarTone: "violet" },
];

const longList: WorkspaceSwitcherEntry[] = [
  ...smallList,
  {
    id: "stark",
    name: "Stark Industries",
    plan: "Enterprise",
    avatarTone: "ember",
    group: "Customers",
  },
  {
    id: "wayne",
    name: "Wayne Enterprises",
    plan: "Enterprise",
    avatarTone: "teal",
    group: "Customers",
  },
  { id: "umbrella", name: "Umbrella Corp", plan: "Free", group: "Customers" },
  {
    id: "chronicle-eng",
    name: "Chronicle — Eng",
    plan: "Internal",
    group: "Chronicle",
  },
  {
    id: "chronicle-ops",
    name: "Chronicle — Ops",
    plan: "Internal",
    group: "Chronicle",
  },
  {
    id: "chronicle-design",
    name: "Chronicle — Design",
    plan: "Internal",
    group: "Chronicle",
  },
];

function Harness({
  workspaces,
  initial,
  ...rest
}: {
  workspaces: WorkspaceSwitcherEntry[];
  initial?: string;
  onCreate?: () => void;
  onManage?: () => void;
}) {
  const [selected, setSelected] = React.useState<string>(
    initial ?? workspaces[0]!.id
  );
  const current = workspaces.find((w) => w.id === selected) ?? workspaces[0]!;
  return (
    <div className="w-[260px] rounded-md border border-hairline bg-surface-01">
      <WorkspaceSwitcher
        current={current}
        workspaces={workspaces}
        onSelect={setSelected}
        {...rest}
      />
    </div>
  );
}

export const Simple: Story = {
  render: () => <Harness workspaces={smallList} />,
};

export const WithCreateAndManage: Story = {
  render: () => (
    <Harness
      workspaces={smallList}
      onCreate={() => console.log("create")}
      onManage={() => console.log("manage")}
    />
  ),
};

export const Searchable: Story = {
  name: "Searchable (many workspaces + groups)",
  render: () => (
    <Harness
      workspaces={longList}
      initial="chronicle-eng"
      onCreate={() => console.log("create")}
      onManage={() => console.log("manage")}
    />
  ),
};

// ─────────────────────────────────────────────────────────────
// Compound API stories — show the Root/Trigger/Popover/... pieces
// ─────────────────────────────────────────────────────────────

function ComposedDemo({
  workspaces,
  initial,
  children,
}: {
  workspaces: WorkspaceSwitcherEntry[];
  initial?: string;
  children: (args: {
    current: WorkspaceSwitcherEntry;
    setSelected: (id: string) => void;
  }) => React.ReactNode;
}) {
  const [selected, setSelected] = React.useState<string>(
    initial ?? workspaces[0]!.id
  );
  const current = workspaces.find((w) => w.id === selected) ?? workspaces[0]!;
  return (
    <div className="w-[300px] rounded-md border border-hairline bg-surface-01">
      {children({ current, setSelected })}
    </div>
  );
}

export const ComposedDefault: Story = {
  name: "Composed — default layout via compound parts",
  render: () => (
    <ComposedDemo workspaces={longList} initial="chronicle-eng">
      {({ current, setSelected }) => (
        <WorkspaceSwitcher
          current={current}
          workspaces={longList}
          onSelect={setSelected}
        >
          <WorkspaceSwitcher.Trigger />
          <WorkspaceSwitcher.Popover>
            <WorkspaceSwitcher.Search />
            <WorkspaceSwitcher.List />
          </WorkspaceSwitcher.Popover>
        </WorkspaceSwitcher>
      )}
    </ComposedDemo>
  ),
};

export const ComposedRearranged: Story = {
  name: "Composed — search at the BOTTOM, multi-action footer",
  render: () => (
    <ComposedDemo workspaces={longList} initial="acme">
      {({ current, setSelected }) => (
        <WorkspaceSwitcher
          current={current}
          workspaces={longList}
          onSelect={setSelected}
        >
          <WorkspaceSwitcher.Trigger />
          <WorkspaceSwitcher.Popover>
            <WorkspaceSwitcher.List />
            {/* Search lives below the list in this layout */}
            <WorkspaceSwitcher.Search force />
            <WorkspaceSwitcher.Footer>
              <WorkspaceSwitcher.Action
                onPress={() => console.log("create")}
                icon={
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    className="h-4 w-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 4.5v15m7.5-7.5h-15"
                    />
                  </svg>
                }
              >
                Create workspace
              </WorkspaceSwitcher.Action>
              <WorkspaceSwitcher.Action
                onPress={() => console.log("invite")}
                icon={
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    className="h-4 w-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z"
                    />
                  </svg>
                }
              >
                Invite teammates
              </WorkspaceSwitcher.Action>
              <WorkspaceSwitcher.Action
                onPress={() => console.log("sign out")}
                icon={
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    className="h-4 w-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"
                    />
                  </svg>
                }
              >
                Sign out
              </WorkspaceSwitcher.Action>
            </WorkspaceSwitcher.Footer>
          </WorkspaceSwitcher.Popover>
        </WorkspaceSwitcher>
      )}
    </ComposedDemo>
  ),
};

export const ComposedCustomItems: Story = {
  name: "Composed — per-item custom rendering",
  render: () => (
    <ComposedDemo workspaces={longList} initial="stark">
      {({ current, setSelected }) => (
        <WorkspaceSwitcher
          current={current}
          workspaces={longList}
          onSelect={setSelected}
        >
          <WorkspaceSwitcher.Trigger />
          <WorkspaceSwitcher.Popover>
            <WorkspaceSwitcher.List>
              <WorkspaceSwitcher.Section title="Pinned">
                <WorkspaceSwitcher.Item workspace={longList[0]!}>
                  {({ workspace, isSelected }) => (
                    <span className="flex w-full items-center justify-between font-mono text-mono-sm uppercase tracking-tactical text-ember">
                      {workspace.name}
                      {isSelected ? (
                        <span className="text-[10px]">CURRENT</span>
                      ) : null}
                    </span>
                  )}
                </WorkspaceSwitcher.Item>
              </WorkspaceSwitcher.Section>
              <WorkspaceSwitcher.Section title="All">
                {longList.map((w) => (
                  <WorkspaceSwitcher.Item key={w.id} workspace={w} />
                ))}
              </WorkspaceSwitcher.Section>
            </WorkspaceSwitcher.List>
          </WorkspaceSwitcher.Popover>
        </WorkspaceSwitcher>
      )}
    </ComposedDemo>
  ),
};
