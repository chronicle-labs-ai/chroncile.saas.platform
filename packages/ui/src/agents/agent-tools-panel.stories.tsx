import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

import { AgentToolsPanel } from "./agent-tools-panel";
import { agentSnapshotsByName } from "./data";
import { ProductChromeFrame } from "./_story-frame";

const meta: Meta<typeof AgentToolsPanel> = {
  title: "Agents/AgentToolsPanel",
  component: AgentToolsPanel,
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
type Story = StoryObj<typeof AgentToolsPanel>;

const support = agentSnapshotsByName["support-agent"]!;
const triage = agentSnapshotsByName["triage-router"]!;

function Harness({ initialVersion }: { initialVersion: string }) {
  const [version, setVersion] = React.useState(initialVersion);
  const summary =
    support.versions.find((v) => v.artifact.version === version) ??
    support.versions[0]!;
  return (
    <AgentToolsPanel
      version={summary}
      versions={support.versions}
      selectedVersion={version}
      onSelectVersion={setVersion}
    />
  );
}

export const ManyTools: Story = {
  render: () => <Harness initialVersion={support.versions[0]!.artifact.version} />,
};

export const NoTools: Story = {
  args: {
    version: triage.versions[0]!,
    versions: triage.versions,
    selectedVersion: triage.versions[0]!.artifact.version,
    onSelectVersion: () => undefined,
  },
};
