import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";

import { trainingDatasetSnapshot } from "./data";
import { DatasetClusterCard } from "./dataset-cluster-card";
import { ProductChromeFrame } from "./_story-frame";

const meta: Meta<typeof DatasetClusterCard> = {
  title: "Datasets/DatasetClusterCard",
  component: DatasetClusterCard,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="md" maxWidth="640px">
        <Story />
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof DatasetClusterCard>;

const firstCluster = trainingDatasetSnapshot.clusters[0]!;
const largestCluster = [...trainingDatasetSnapshot.clusters].sort(
  (a, b) => b.traceIds.length - a.traceIds.length,
)[0]!;

export const Default: Story = {
  args: {
    cluster: firstCluster,
    traces: trainingDatasetSnapshot.traces,
    onSelectTrace: () => undefined,
  },
};

export const Collapsed: Story = {
  args: {
    cluster: firstCluster,
    traces: trainingDatasetSnapshot.traces,
    defaultOpen: false,
    onSelectTrace: () => undefined,
  },
};

export const ManyTraces: Story = {
  args: {
    cluster: largestCluster,
    traces: trainingDatasetSnapshot.traces,
    initialVisible: 4,
    onSelectTrace: () => undefined,
  },
};

export const WithDescription: Story = {
  args: {
    cluster: {
      ...firstCluster,
      description:
        "Traces where the agent successfully resolved an authentication-related ticket within 3 turns.",
    },
    traces: trainingDatasetSnapshot.traces,
    onSelectTrace: () => undefined,
  },
};

export const Selected: Story = {
  render: function Render() {
    const [selectedId, setSelectedId] = React.useState<string | null>(
      firstCluster.traceIds[0] ?? null,
    );
    return (
      <DatasetClusterCard
        cluster={firstCluster}
        traces={trainingDatasetSnapshot.traces}
        selectedTraceId={selectedId}
        onSelectTrace={setSelectedId}
      />
    );
  },
};
