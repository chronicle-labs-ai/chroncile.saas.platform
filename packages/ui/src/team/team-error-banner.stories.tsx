import type { Meta, StoryObj } from "@storybook/react";
import { TeamErrorBanner } from "./team-error-banner";

const meta: Meta<typeof TeamErrorBanner> = {
  title: "Team/TeamErrorBanner",
  component: TeamErrorBanner,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof TeamErrorBanner>;

export const Default: Story = {
  render: () => (
    <div className="w-[640px]">
      <TeamErrorBanner>
        Failed to load members [403 forbidden].
      </TeamErrorBanner>
    </div>
  ),
};
