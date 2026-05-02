import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";

import { Checkbox } from "../primitives/checkbox";

import { trainingDatasetSnapshot } from "./data";
import { TraceSummaryRow, buildClusterIndex } from "./trace-summary-row";
import { ProductChromeFrame } from "./_story-frame";

const meta: Meta<typeof TraceSummaryRow> = {
  title: "Datasets/TraceSummaryRow",
  component: TraceSummaryRow,
  parameters: { layout: "fullscreen" },
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
type Story = StoryObj<typeof TraceSummaryRow>;

const clusterIndex = buildClusterIndex(trainingDatasetSnapshot.clusters);
const sample = trainingDatasetSnapshot.traces[0]!;
const sampleCluster = sample.clusterId
  ? clusterIndex.get(sample.clusterId) ?? null
  : null;

export const Default: Story = {
  args: {
    trace: sample,
    cluster: sampleCluster,
    onSelect: () => undefined,
  },
};

export const Active: Story = {
  args: {
    trace: sample,
    cluster: sampleCluster,
    isActive: true,
    onSelect: () => undefined,
  },
};

export const NoCluster: Story = {
  args: {
    trace: sample,
    cluster: null,
    onSelect: () => undefined,
  },
};

export const Comfy: Story = {
  args: {
    trace: sample,
    cluster: sampleCluster,
    density: "comfy",
    onSelect: () => undefined,
  },
};

export const WithCheckbox: Story = {
  render: function Render() {
    const [checked, setChecked] = React.useState(false);
    return (
      <TraceSummaryRow
        trace={sample}
        cluster={sampleCluster}
        onSelect={() => undefined}
        selectSlot={
          <Checkbox
            density="compact"
            isSelected={checked}
            onChange={setChecked}
            aria-label="Select trace"
          />
        }
      />
    );
  },
};

export const Stack: Story = {
  render: () => (
    <>
      {trainingDatasetSnapshot.traces.slice(0, 8).map((trace) => (
        <TraceSummaryRow
          key={trace.traceId}
          trace={trace}
          cluster={
            trace.clusterId ? clusterIndex.get(trace.clusterId) ?? null : null
          }
          onSelect={() => undefined}
        />
      ))}
    </>
  ),
};
