import type { Meta, StoryObj } from "@storybook/react";

import { AgentPulseBar } from "./agent-pulse-bar";
import { agentSnapshotsByName } from "./data";
import { ProductChromeFrame } from "./_story-frame";

const meta: Meta<typeof AgentPulseBar> = {
  title: "Agents/AgentPulseBar",
  component: AgentPulseBar,
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="md" maxWidth="360px">
        <Story />
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof AgentPulseBar>;

export const HealthySupport: Story = {
  args: {
    runs: agentSnapshotsByName["support-agent"]!.runs,
  },
};

export const DriftingTriage: Story = {
  args: {
    runs: agentSnapshotsByName["triage-router"]!.runs,
  },
};

export const SmallSample: Story = {
  args: {
    runs: agentSnapshotsByName["research-bot"]!.runs,
  },
};

export const NoRuns: Story = {
  args: {
    runs: [],
  },
};
