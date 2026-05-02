import type { Meta, StoryObj } from "@storybook/react";

import { AgentDetailPage } from "./agent-detail-page";
import { agentSnapshotsByName } from "./data";
import { ProductChromeFrame } from "./_story-frame";

const meta: Meta<typeof AgentDetailPage> = {
  title: "Agents/AgentDetailPage",
  component: AgentDetailPage,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="none">
        <div className="flex h-screen flex-col bg-l-surface p-4">
          <div className="flex flex-1 min-h-0 flex-col rounded-[4px] border border-l-border bg-l-surface-raised">
            <Story />
          </div>
        </div>
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof AgentDetailPage>;

export const SupportOverview: Story = {
  args: {
    snapshot: agentSnapshotsByName["support-agent"]!,
    defaultTab: "overview",
  },
};

export const SupportVersions: Story = {
  args: {
    snapshot: agentSnapshotsByName["support-agent"]!,
    defaultTab: "versions",
  },
};

export const SupportDiff: Story = {
  args: {
    snapshot: agentSnapshotsByName["support-agent"]!,
    defaultTab: "diff",
  },
};

export const SupportRuns: Story = {
  args: {
    snapshot: agentSnapshotsByName["support-agent"]!,
    defaultTab: "runs",
  },
};

export const SupportTools: Story = {
  args: {
    snapshot: agentSnapshotsByName["support-agent"]!,
    defaultTab: "tools",
  },
};

export const SupportDrift: Story = {
  args: {
    snapshot: agentSnapshotsByName["support-agent"]!,
    defaultTab: "drift",
  },
};

export const SingleVersion: Story = {
  args: {
    snapshot: agentSnapshotsByName["research-bot"]!,
    defaultTab: "overview",
  },
};
