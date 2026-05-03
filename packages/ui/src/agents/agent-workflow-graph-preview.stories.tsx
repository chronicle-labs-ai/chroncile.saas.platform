import type { Meta, StoryObj } from "@storybook/react";

import { AgentWorkflowGraphPreview } from "./agent-workflow-graph-preview";
import { agentSnapshotsByName } from "./data";
import { ProductChromeFrame } from "./_story-frame";
import type { AgentWorkflowGraph } from "./types";

const meta: Meta<typeof AgentWorkflowGraphPreview> = {
  title: "Agents/AgentWorkflowGraphPreview",
  component: AgentWorkflowGraphPreview,
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="md" maxWidth="780px">
        <Story />
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof AgentWorkflowGraphPreview>;

const supportLatest =
  agentSnapshotsByName["support-agent"]!.versions[0]!.artifact
    .workflowGraphPreview!;
const refundLatest =
  agentSnapshotsByName["refund-agent"]!.versions[0]!.artifact
    .workflowGraphPreview!;
const triageLatest =
  agentSnapshotsByName["triage-router"]!.versions[0]!.artifact
    .workflowGraphPreview!;
const knowledgeLatest =
  agentSnapshotsByName["knowledge-rag"]!.versions[0]!.artifact
    .workflowGraphPreview!;

export const Support: Story = {
  args: { graph: supportLatest, density: "default" },
};

export const Refund: Story = {
  args: { graph: refundLatest, density: "default" },
};

export const Triage: Story = {
  args: { graph: triageLatest, density: "default" },
};

export const Knowledge: Story = {
  args: { graph: knowledgeLatest, density: "default" },
};

export const Compact: Story = {
  args: { graph: supportLatest, density: "compact" },
};

const minimalGraph: AgentWorkflowGraph = {
  nodes: [
    { id: "in", kind: "input", label: "Question" },
    { id: "model", kind: "model", label: "Reason" },
    { id: "out", kind: "output", label: "Answer" },
  ],
  edges: [
    { from: "in", to: "model" },
    { from: "model", to: "out" },
  ],
};

export const Minimal: Story = {
  args: { graph: minimalGraph, density: "compact" },
};
