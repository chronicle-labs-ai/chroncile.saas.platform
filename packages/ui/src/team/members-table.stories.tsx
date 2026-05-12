import type { Meta, StoryObj } from "@storybook/react";
import { MembersTable } from "./members-table";
import type { TeamMember } from "./types";

const meta: Meta<typeof MembersTable> = {
  title: "Team/MembersTable",
  component: MembersTable,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof MembersTable>;

const sampleMembers: TeamMember[] = [
  {
    id: "m1",
    userId: "u_owner",
    email: "marisol@chronicle.dev",
    firstName: "Marisol",
    lastName: "Vega",
    role: { slug: "admin" },
    status: "active",
    isOwner: true,
    isSelf: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "m2",
    userId: "u_self",
    email: "you@chronicle.dev",
    firstName: "Ada",
    lastName: "Lovelace",
    role: { slug: "member" },
    status: "active",
    isOwner: false,
    isSelf: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "m3",
    userId: "u_third",
    email: "ben@chronicle.dev",
    firstName: null,
    lastName: null,
    role: { slug: "viewer" },
    status: "inactive",
    isOwner: false,
    isSelf: false,
    createdAt: new Date().toISOString(),
  },
];

export const Default: Story = {
  render: () => (
    <div className="w-[960px]">
      <MembersTable
        members={sampleMembers}
        onRoleChange={() => {}}
        onRemove={() => {}}
        onLeave={() => {}}
      />
    </div>
  ),
};

export const Loading: Story = {
  render: () => (
    <div className="w-[960px]">
      <MembersTable
        members={[]}
        isLoading
        onRoleChange={() => {}}
        onRemove={() => {}}
        onLeave={() => {}}
      />
    </div>
  ),
};

export const Empty: Story = {
  render: () => (
    <div className="w-[960px]">
      <MembersTable
        members={[]}
        onRoleChange={() => {}}
        onRemove={() => {}}
        onLeave={() => {}}
      />
    </div>
  ),
};
