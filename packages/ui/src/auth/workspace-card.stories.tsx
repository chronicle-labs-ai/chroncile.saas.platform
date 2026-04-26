import type { Meta, StoryObj } from "@storybook/react";
import { WorkspaceCard } from "./workspace-card";

const meta: Meta<typeof WorkspaceCard> = {
  title: "Auth/WorkspaceCard",
  component: WorkspaceCard,
  parameters: { layout: "padded" },
  argTypes: {
    role: {
      control: "select",
      options: ["Owner", "Admin", "Member", "Viewer"],
    },
  },
  args: {
    role: "Owner",
    name: "Acme Industries",
    memberCount: 24,
    lastSeen: "2h ago",
  },
};
export default meta;
type Story = StoryObj<typeof WorkspaceCard>;

export const Default: Story = {
  render: (args) => (
    <div className="w-[460px]">
      <WorkspaceCard {...args} onPress={() => alert("press " + args.name)} />
    </div>
  ),
};

export const RoleOwner: Story = {
  args: { role: "Owner", name: "Acme Industries" },
  render: (args) => (
    <div className="w-[460px]">
      <WorkspaceCard {...args} />
    </div>
  ),
};

export const RoleAdmin: Story = {
  args: { role: "Admin", name: "Globex Corp" },
  render: (args) => (
    <div className="w-[460px]">
      <WorkspaceCard {...args} />
    </div>
  ),
};

export const RoleMember: Story = {
  args: { role: "Member", name: "Initech" },
  render: (args) => (
    <div className="w-[460px]">
      <WorkspaceCard {...args} />
    </div>
  ),
};

export const RoleViewer: Story = {
  args: { role: "Viewer", name: "Wayne Enterprises" },
  render: (args) => (
    <div className="w-[460px]">
      <WorkspaceCard {...args} />
    </div>
  ),
};

export const WithoutMemberCount: Story = {
  args: { memberCount: undefined, lastSeen: undefined },
  render: (args) => (
    <div className="w-[460px]">
      <WorkspaceCard {...args} />
    </div>
  ),
};

export const FocusedAndHovered: Story = {
  name: "focus + hover state",
  render: (args) => (
    <div className="flex w-[460px] flex-col gap-s-2">
      <WorkspaceCard {...args} autoFocus />
      <span className="font-mono text-mono-sm text-ink-dim">
        Tab into the card above (shows the focus ring); hover from anywhere on
        the row to see the ember border + arrow shift.
      </span>
    </div>
  ),
};

export const Stack: Story = {
  name: "list of 6",
  render: () => (
    <div className="flex w-[460px] flex-col gap-s-2">
      <WorkspaceCard
        name="Acme Industries"
        role="Owner"
        memberCount={24}
        lastSeen="2h ago"
      />
      <WorkspaceCard
        name="Globex Corp"
        role="Admin"
        memberCount={6}
        lastSeen="yesterday"
      />
      <WorkspaceCard
        name="Initech"
        role="Member"
        memberCount={142}
        lastSeen="now"
      />
      <WorkspaceCard
        name="Soylent Corp"
        role="Viewer"
        memberCount={3}
        lastSeen="3d ago"
      />
      <WorkspaceCard
        name="Wayne Enterprises"
        role="Owner"
        memberCount={88}
        lastSeen="5m ago"
      />
      <WorkspaceCard
        name="Cyberdyne Systems"
        role="Admin"
        memberCount={12}
        lastSeen="last week"
      />
    </div>
  ),
};
