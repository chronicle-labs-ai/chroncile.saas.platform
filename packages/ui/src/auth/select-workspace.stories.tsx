import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { SelectWorkspace, type Workspace } from "./select-workspace";
import { AuthShell } from "./auth-shell";

const meta: Meta<typeof SelectWorkspace> = {
  title: "Auth/SelectWorkspace",
  component: SelectWorkspace,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof SelectWorkspace>;

const Frame = ({ children }: { children: React.ReactNode }) => (
  <AuthShell topbar={false}>{children}</AuthShell>
);

const TWO_WORKSPACES: Workspace[] = [
  {
    id: "ws_1",
    name: "Acme Industries",
    role: "Owner",
    memberCount: 24,
    lastSeen: "2h ago",
  },
  {
    id: "ws_2",
    name: "Globex Corp",
    role: "Admin",
    memberCount: 6,
    lastSeen: "yesterday",
  },
];

const SIX_WORKSPACES: Workspace[] = [
  ...TWO_WORKSPACES,
  {
    id: "ws_3",
    name: "Initech",
    role: "Member",
    memberCount: 142,
    lastSeen: "now",
  },
  {
    id: "ws_4",
    name: "Soylent Corp",
    role: "Viewer",
    memberCount: 3,
    lastSeen: "3d ago",
  },
  {
    id: "ws_5",
    name: "Wayne Enterprises",
    role: "Owner",
    memberCount: 88,
    lastSeen: "5m ago",
  },
  {
    id: "ws_6",
    name: "Cyberdyne Systems",
    role: "Admin",
    memberCount: 12,
    lastSeen: "last week",
  },
];

export const G0Zero: Story = {
  name: "G.0 · zero memberships",
  render: () => (
    <Frame>
      <SelectWorkspace
        workspaces={[]}
        onSelect={(id) => alert("select " + id)}
        onCreateNew={() => alert("create new")}
        onSignOut={() => alert("sign out")}
      />
    </Frame>
  ),
};

export const G1AutoRoute: Story = {
  name: "G.1 · 1 membership · auto-route",
  render: () => (
    <Frame>
      <SelectWorkspace
        workspaces={[TWO_WORKSPACES[0]!]}
        autoRouting
        onSelect={(id) => alert("select " + id)}
      />
    </Frame>
  ),
};

export const G2TwoCards: Story = {
  name: "G.2 · 2 cards",
  render: () => (
    <Frame>
      <SelectWorkspace
        workspaces={TWO_WORKSPACES}
        onSelect={(id) => alert("select " + id)}
        onCreateNew={() => alert("create new")}
      />
    </Frame>
  ),
};

export const G5SixWithSearch: Story = {
  name: "G.5 · 6 with search filter",
  render: () => (
    <Frame>
      <SelectWorkspace
        workspaces={SIX_WORKSPACES}
        onSelect={(id) => alert("select " + id)}
        onCreateNew={() => alert("create new")}
      />
    </Frame>
  ),
};
