import type { Meta, StoryObj } from "@storybook/react";

import { AgentVersionBadge } from "./agent-version-badge";
import { ProductChromeFrame } from "./_story-frame";

const meta: Meta<typeof AgentVersionBadge> = {
  title: "Agents/atoms/AgentVersionBadge",
  component: AgentVersionBadge,
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="md" maxWidth="480px">
        <Story />
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof AgentVersionBadge>;

export const Default: Story = {
  args: { version: "1.2.0", status: "current" },
};

export const AllStatuses: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <AgentVersionBadge version="1.2.0" status="current" />
        <AgentVersionBadge version="1.1.0" status="stable" />
        <AgentVersionBadge version="1.0.0" status="deprecated" />
        <AgentVersionBadge version="2.0.0-beta.1" status="draft" />
      </div>
      <div className="flex items-center gap-2">
        <AgentVersionBadge version="1.2.0" status="current" size="md" />
        <AgentVersionBadge version="1.1.0" status="stable" size="md" />
      </div>
    </div>
  ),
};
