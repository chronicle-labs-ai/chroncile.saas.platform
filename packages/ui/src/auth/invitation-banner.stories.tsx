import type { Meta, StoryObj } from "@storybook/react";
import { InvitationBanner } from "./invitation-banner";

const meta: Meta<typeof InvitationBanner> = {
  title: "Auth/InvitationBanner",
  component: InvitationBanner,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof InvitationBanner>;

export const Default: Story = {
  render: () => (
    <div className="w-[480px]">
      <InvitationBanner orgName="Chronicle Labs" onSignIn={() => {}} />
    </div>
  ),
};

export const NoOrgName: Story = {
  render: () => (
    <div className="w-[480px]">
      <InvitationBanner onSignIn={() => {}} />
    </div>
  ),
};
