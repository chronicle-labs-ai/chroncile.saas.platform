import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

import { AgentRunDetailDrawer } from "./agent-run-detail-drawer";
import { Button } from "../primitives/button";
import { agentSnapshotsByName } from "./data";
import { ProductChromeFrame } from "./_story-frame";

const meta: Meta<typeof AgentRunDetailDrawer> = {
  title: "Agents/AgentRunDetailDrawer",
  component: AgentRunDetailDrawer,
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
type Story = StoryObj<typeof AgentRunDetailDrawer>;

const support = agentSnapshotsByName["support-agent"]!;
const successRun =
  support.runs.find((r) => r.status === "success") ?? support.runs[0]!;
const errorRun =
  support.runs.find((r) => r.status === "error") ?? support.runs[0]!;

function Harness({ runId }: { runId: string }) {
  const [open, setOpen] = React.useState(true);
  const run = support.runs.find((r) => r.runId === runId) ?? null;
  return (
    <div className="flex flex-col gap-3">
      <Button
        variant="secondary"
        size="sm"
        onPress={() => setOpen(true)}
      >
        Open run drawer
      </Button>
      <AgentRunDetailDrawer
        isOpen={open}
        onClose={() => setOpen(false)}
        run={run}
        snapshot={support}
        onOpenHashSearch={() => undefined}
      />
    </div>
  );
}

export const SuccessRun: Story = {
  render: () => <Harness runId={successRun.runId} />,
};

export const ErroredRun: Story = {
  render: () => <Harness runId={errorRun.runId} />,
};
