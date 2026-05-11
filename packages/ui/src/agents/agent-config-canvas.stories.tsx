import type { Meta, StoryObj } from "@storybook/react";

import { AgentConfigCanvas } from "./agent-config-canvas";
import { agentSnapshotsByName } from "./data";
import { ProductChromeFrame } from "./_story-frame";

const meta: Meta<typeof AgentConfigCanvas> = {
  title: "Agents/AgentConfigCanvas",
  component: AgentConfigCanvas,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="md">
        <Story />
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof AgentConfigCanvas>;

export const SupportAgent: Story = {
  args: {
    snapshot: agentSnapshotsByName["support-agent"]!,
  },
};

export const RefundAgent: Story = {
  args: {
    snapshot: agentSnapshotsByName["refund-agent"]!,
  },
};

export const TriageRouter: Story = {
  args: {
    snapshot: agentSnapshotsByName["triage-router"]!,
  },
};

export const KnowledgeRag: Story = {
  args: {
    snapshot: agentSnapshotsByName["knowledge-rag"]!,
  },
};

export const ResearchBot: Story = {
  args: {
    snapshot: agentSnapshotsByName["research-bot"]!,
  },
};
