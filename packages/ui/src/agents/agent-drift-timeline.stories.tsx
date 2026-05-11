import type { Meta, StoryObj } from "@storybook/react";

import { AgentDriftTimeline } from "./agent-drift-timeline";
import { agentSnapshotsByName, buildDriftEntries } from "./data";
import { ProductChromeFrame } from "./_story-frame";

const meta: Meta<typeof AgentDriftTimeline> = {
  title: "Agents/AgentDriftTimeline",
  component: AgentDriftTimeline,
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
type Story = StoryObj<typeof AgentDriftTimeline>;

export const SupportDrift: Story = {
  args: {
    entries: buildDriftEntries(agentSnapshotsByName["support-agent"]!),
    onSelectRun: () => undefined,
  },
};

export const NoDrift: Story = {
  args: {
    entries: buildDriftEntries(agentSnapshotsByName["research-bot"]!),
  },
};
