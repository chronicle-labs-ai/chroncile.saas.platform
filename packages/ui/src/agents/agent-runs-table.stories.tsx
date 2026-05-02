import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

import { AgentRunsTable } from "./agent-runs-table";
import { agentSnapshotsByName } from "./data";
import { ProductChromeFrame } from "./_story-frame";

const meta: Meta<typeof AgentRunsTable> = {
  title: "Agents/AgentRunsTable",
  component: AgentRunsTable,
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
type Story = StoryObj<typeof AgentRunsTable>;

const support = agentSnapshotsByName["support-agent"]!;

function Harness({
  density,
  hideHeader,
}: {
  density?: "compact" | "default";
  hideHeader?: boolean;
}) {
  const [selected, setSelected] = React.useState<string | null>(null);
  return (
    <AgentRunsTable
      runs={support.runs}
      versions={support.versions}
      selectedRunId={selected}
      onSelectRun={setSelected}
      density={density}
      hideHeader={hideHeader}
    />
  );
}

export const Default: Story = { render: () => <Harness /> };

export const HeaderlessOverview: Story = {
  render: () => <Harness density="compact" hideHeader />,
};

