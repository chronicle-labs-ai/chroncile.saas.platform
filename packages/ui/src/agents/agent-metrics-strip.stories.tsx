import type { Meta, StoryObj } from "@storybook/react";

import { AgentMetricsStrip } from "./agent-metrics-strip";
import { agentSnapshotsByName } from "./data";
import { ProductChromeFrame } from "./_story-frame";

const meta: Meta<typeof AgentMetricsStrip> = {
  title: "Agents/AgentMetricsStrip",
  component: AgentMetricsStrip,
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="md" maxWidth="1100px">
        <Story />
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof AgentMetricsStrip>;

export const SupportAgent: Story = {
  args: { snapshot: agentSnapshotsByName["support-agent"]! },
};

export const TriageRouter: Story = {
  args: { snapshot: agentSnapshotsByName["triage-router"]! },
};
