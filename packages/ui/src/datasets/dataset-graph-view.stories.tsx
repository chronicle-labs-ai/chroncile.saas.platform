import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";

import {
  denseSyntheticSnapshot,
  emptyDatasetSnapshot,
  evalDatasetSnapshot,
  replayDatasetSnapshot,
  reviewDatasetSnapshot,
  trainingDatasetSnapshot,
} from "./data";
import { DatasetGraphView } from "./dataset-graph-view";
import { ProductChromeFrame } from "./_story-frame";
import type { DatasetSnapshot } from "./types";

const meta: Meta<typeof DatasetGraphView> = {
  title: "Datasets/DatasetGraphView",
  component: DatasetGraphView,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Canvas-2D scatter for visually inspecting traces in a dataset. **Each dot represents one trace** (a multi-event series), colored by cluster. Hover any point to surface a rich preview card; click to select. Smooth pan/zoom — drag to pan, scroll to zoom around the cursor. Inspired by https://github.com/GrantCuster/umap-explorer.",
      },
    },
  },
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="md">
        <div className="h-[680px] w-full overflow-hidden rounded-[4px] border border-l-border">
          <Story />
        </div>
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof DatasetGraphView>;

function Wrapper({ snapshot }: { snapshot: DatasetSnapshot }) {
  return function Component() {
    const [selectedId, setSelectedId] = React.useState<string | null>(null);
    return (
      <DatasetGraphView
        snapshot={snapshot}
        selectedTraceId={selectedId}
        onSelectTrace={setSelectedId}
      />
    );
  };
}

/**
 * Default — the canonical training dataset (~250 multi-event traces
 * across 6 clusters: password reset, billing, onboarding, API errors,
 * search, sync). Hover any dot to see the trace's primary source,
 * event count, duration, and split.
 */
export const Default: Story = {
  render: Wrapper({ snapshot: trainingDatasetSnapshot }),
};

/**
 * Eval suite — smaller curated suite (~75 traces, 3 tighter clusters).
 * Useful for visualising a "tight, low-noise" cluster shape.
 */
export const SmallDataset: Story = {
  render: Wrapper({ snapshot: evalDatasetSnapshot }),
};

/**
 * Replay · billing — two well-separated clusters (~50 traces total).
 */
export const TwoClusters: Story = {
  render: Wrapper({ snapshot: replayDatasetSnapshot }),
};

/**
 * Review queue — small, single-cluster ("Unsorted") dataset that
 * shows what a fresh review backlog looks like before traces are
 * sorted into proper clusters.
 */
export const SingleCluster: Story = {
  render: Wrapper({ snapshot: reviewDatasetSnapshot }),
};

/**
 * Selected — the same training snapshot with a trace pre-selected so
 * the ember ring + edge highlight + dimmed neighbors all paint on
 * mount.
 */
export const Selected: Story = {
  render: function Render() {
    const firstId = trainingDatasetSnapshot.traces[0]?.traceId ?? null;
    const [selectedId, setSelectedId] = React.useState<string | null>(firstId);
    return (
      <DatasetGraphView
        snapshot={trainingDatasetSnapshot}
        selectedTraceId={selectedId}
        onSelectTrace={setSelectedId}
      />
    );
  },
};

/**
 * Empty — zero-state story when a dataset has no traces yet.
 */
export const EmptyDataset: Story = {
  render: Wrapper({ snapshot: emptyDatasetSnapshot }),
};

/**
 * Dense — ~520 multi-event traces across 8 clusters. Stress-tests the
 * canvas hover/zoom interaction; every point is still hover-responsive
 * because hit testing is done in layout space, not per-DOM-node.
 */
export const DenseDataset: Story = {
  render: Wrapper({ snapshot: denseSyntheticSnapshot }),
};
