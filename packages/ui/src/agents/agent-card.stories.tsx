import type { Meta, StoryObj } from "@storybook/react";

import { AgentCard } from "./agent-card";
import { agentsManagerSeed } from "./data";
import { ProductChromeFrame } from "./_story-frame";

const meta: Meta<typeof AgentCard> = {
  title: "Agents/AgentCard",
  component: AgentCard,
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="md" maxWidth="360px">
        <Story />
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof AgentCard>;

export const Default: Story = {
  args: { agent: agentsManagerSeed[0]! },
};

export const Drifting: Story = {
  args: {
    agent:
      agentsManagerSeed.find((a) => a.lastDriftAt) ?? agentsManagerSeed[0]!,
  },
};

export const Selected: Story = {
  args: { agent: agentsManagerSeed[1]!, isActive: true },
};

export const NoRuns: Story = {
  args: {
    agent: {
      ...agentsManagerSeed[0]!,
      totalRuns: 0,
      successRate: 0,
      lastRunAt: undefined,
      lastDriftAt: undefined,
    },
  },
};
