import type { Meta, StoryObj } from "@storybook/react";
import { InvitationsTable } from "./invitations-table";
import type { TeamInvitation } from "./types";

const meta: Meta<typeof InvitationsTable> = {
  title: "Team/InvitationsTable",
  component: InvitationsTable,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof InvitationsTable>;

const sampleInvitations: TeamInvitation[] = [
  {
    id: "i1",
    email: "newhire@chronicle.dev",
    state: "pending",
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
    acceptedAt: null,
    revokedAt: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: "i2",
    email: "lapsed@chronicle.dev",
    state: "expired",
    expiresAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    acceptedAt: null,
    revokedAt: null,
    createdAt: new Date().toISOString(),
  },
];

export const Default: Story = {
  render: () => (
    <div className="w-[960px]">
      <InvitationsTable
        invitations={sampleInvitations}
        onResend={() => {}}
        onRevoke={() => {}}
      />
    </div>
  ),
};

export const Empty: Story = {
  render: () => (
    <div className="w-[960px]">
      <InvitationsTable
        invitations={[]}
        onResend={() => {}}
        onRevoke={() => {}}
      />
    </div>
  ),
};
