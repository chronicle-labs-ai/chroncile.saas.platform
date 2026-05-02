import type { Meta, StoryObj } from "@storybook/react";

import { AgentRunRow } from "./agent-run-row";
import { agentSnapshotsByName } from "./data";
import { ProductChromeFrame } from "./_story-frame";

const meta: Meta<typeof AgentRunRow> = {
  title: "Agents/AgentRunRow",
  component: AgentRunRow,
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="md" maxWidth="900px">
        <div className="rounded-[4px] border border-l-border bg-l-surface-raised">
          <Story />
        </div>
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof AgentRunRow>;

const supportRuns = agentSnapshotsByName["support-agent"]!.runs;

export const Success: Story = {
  args: {
    run: supportRuns.find((r) => r.status === "success") ?? supportRuns[0]!,
    onSelect: () => undefined,
  },
};

export const Error: Story = {
  args: {
    run: supportRuns.find((r) => r.status === "error") ?? supportRuns[0]!,
    onSelect: () => undefined,
  },
};

export const Stack: Story = {
  render: () => (
    <>
      {supportRuns.slice(0, 8).map((r) => (
        <AgentRunRow key={r.runId} run={r} onSelect={() => undefined} />
      ))}
    </>
  ),
};
