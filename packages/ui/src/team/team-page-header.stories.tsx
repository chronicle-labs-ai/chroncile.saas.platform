import type { Meta, StoryObj } from "@storybook/react";
import { TeamPageHeader } from "./team-page-header";

const meta: Meta<typeof TeamPageHeader> = {
  title: "Team/TeamPageHeader",
  component: TeamPageHeader,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof TeamPageHeader>;

export const Default: Story = {
  render: () => (
    <div className="w-[960px]">
      <TeamPageHeader
        orgName="Chronicle Labs"
        orgSlug="chronicle"
        onInvite={() => {}}
      />
    </div>
  ),
};

export const NoSlug: Story = {
  render: () => (
    <div className="w-[960px]">
      <TeamPageHeader orgName="Acme Co" onInvite={() => {}} />
    </div>
  ),
};
