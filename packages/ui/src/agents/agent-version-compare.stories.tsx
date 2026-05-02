import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

import { AgentVersionCompare } from "./agent-version-compare";
import { agentSnapshotsByName } from "./data";
import { ProductChromeFrame } from "./_story-frame";

const meta: Meta<typeof AgentVersionCompare> = {
  title: "Agents/AgentVersionCompare",
  component: AgentVersionCompare,
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
type Story = StoryObj<typeof AgentVersionCompare>;

const supportVersions = agentSnapshotsByName["support-agent"]!.versions;

function Harness({
  defaultFrom,
  defaultTo,
}: {
  defaultFrom: string;
  defaultTo: string;
}) {
  const [from, setFrom] = React.useState(defaultFrom);
  const [to, setTo] = React.useState(defaultTo);
  return (
    <AgentVersionCompare
      versions={supportVersions}
      fromVersion={from}
      toVersion={to}
      onFromChange={setFrom}
      onToChange={setTo}
    />
  );
}

export const PromptAndModelChange: Story = {
  render: () => (
    <Harness
      defaultFrom={supportVersions[2]!.artifact.version}
      defaultTo={supportVersions[0]!.artifact.version}
    />
  ),
};

export const PromptOnlyChange: Story = {
  render: () => (
    <Harness
      defaultFrom={supportVersions[2]!.artifact.version}
      defaultTo={supportVersions[1]!.artifact.version}
    />
  ),
};

export const SameVersion: Story = {
  render: () => (
    <Harness
      defaultFrom={supportVersions[0]!.artifact.version}
      defaultTo={supportVersions[0]!.artifact.version}
    />
  ),
};
