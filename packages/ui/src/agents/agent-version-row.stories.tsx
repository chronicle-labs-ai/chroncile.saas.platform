import type { Meta, StoryObj } from "@storybook/react";

import { AgentVersionRow } from "./agent-version-row";
import { agentSnapshotsByName } from "./data";
import { ProductChromeFrame } from "./_story-frame";

const meta: Meta<typeof AgentVersionRow> = {
  title: "Agents/AgentVersionRow",
  component: AgentVersionRow,
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="md" maxWidth="1100px">
        <div className="rounded-[4px] border border-hairline-strong bg-l-surface-raised">
          <Story />
        </div>
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof AgentVersionRow>;

const supportVersions = agentSnapshotsByName["support-agent"]!.versions;

export const Current: Story = {
  args: { version: supportVersions[0]!, hideCompare: true },
};

export const Stable: Story = {
  args: { version: supportVersions[1]! },
};

export const Deprecated: Story = {
  args: { version: supportVersions[2]! },
};

export const Stack: Story = {
  render: () => (
    <>
      {supportVersions.map((v, i) => (
        <AgentVersionRow
          key={v.artifact.artifactId}
          version={v}
          hideCompare={i === 0}
        />
      ))}
    </>
  ),
};
