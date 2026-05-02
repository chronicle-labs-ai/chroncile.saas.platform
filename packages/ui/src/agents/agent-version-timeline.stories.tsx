import type { Meta, StoryObj } from "@storybook/react";

import { AgentVersionTimeline } from "./agent-version-timeline";
import { agentSnapshotsByName } from "./data";
import { ProductChromeFrame } from "./_story-frame";

const meta: Meta<typeof AgentVersionTimeline> = {
  title: "Agents/AgentVersionTimeline",
  component: AgentVersionTimeline,
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="md" maxWidth="380px">
        <Story />
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof AgentVersionTimeline>;

export const Default: Story = {
  args: {
    versions: agentSnapshotsByName["support-agent"]!.versions,
    selectedVersion: agentSnapshotsByName["support-agent"]!.versions[0]
      ?.artifact.version,
  },
};

export const TwoVersions: Story = {
  args: {
    versions: agentSnapshotsByName["refund-agent"]!.versions,
  },
};

export const Empty: Story = {
  args: { versions: [] },
};
