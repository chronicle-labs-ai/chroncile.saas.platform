import type { Meta, StoryObj } from "@storybook/react";

import { AgentActionsMenu } from "./agent-actions-menu";
import { agentsManagerSeed, agentSnapshotsByName } from "./data";
import { ProductChromeFrame } from "./_story-frame";

const meta: Meta<typeof AgentActionsMenu> = {
  title: "Agents/AgentActionsMenu",
  component: AgentActionsMenu,
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="md" maxWidth="320px">
        <Story />
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof AgentActionsMenu>;

const agent = agentsManagerSeed[0]!;
const snapshot = agentSnapshotsByName[agent.name];
const configHash = snapshot?.versions[0]?.artifact.configHash;

export const Default: Story = {
  args: {
    agent,
    configHash,
    onOpen: () => undefined,
    onPinLatest: () => undefined,
    onCopyArtifactId: () => undefined,
    onCopyConfigHash: () => undefined,
    onOpenHashSearch: () => undefined,
  },
};

export const PinnedAlready: Story = {
  args: {
    agent,
    configHash,
    isPinned: true,
    onOpen: () => undefined,
    onUnpinLatest: () => undefined,
    onCopyArtifactId: () => undefined,
    onCopyConfigHash: () => undefined,
    onOpenHashSearch: () => undefined,
  },
};
