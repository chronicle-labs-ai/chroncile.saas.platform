import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";

import {
  emptyDatasetSnapshot,
  evalDatasetSnapshot,
  reviewDatasetSnapshot,
  trainingDatasetSnapshot,
} from "./data";
import { DatasetDetailPage } from "./dataset-detail-page";
import { ProductChromeFrame } from "./_story-frame";
import type { DatasetSnapshot, UpdateDatasetHandler } from "./types";

const meta: Meta<typeof DatasetDetailPage> = {
  title: "Datasets/DatasetDetailPage",
  component: DatasetDetailPage,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="none">
        <div className="flex h-screen min-h-0 flex-col p-3">
          <div className="flex flex-1 min-h-0 flex-col rounded-[4px] border border-l-border bg-l-surface-raised">
            <Story />
          </div>
        </div>
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof DatasetDetailPage>;

function Wrapper({
  snapshot: initial,
  defaultTab,
}: {
  snapshot: DatasetSnapshot;
  defaultTab?: React.ComponentProps<typeof DatasetDetailPage>["defaultTab"];
}) {
  return function Component() {
    const [snapshot, setSnapshot] = React.useState(initial);
    const handleUpdate: UpdateDatasetHandler = ({ id, patch }) => {
      const next = {
        ...snapshot,
        dataset: { ...snapshot.dataset, ...patch, id, updatedAt: new Date().toISOString() },
      };
      setSnapshot(next);
      return next.dataset;
    };
    return (
      <DatasetDetailPage
        snapshot={snapshot}
        defaultTab={defaultTab}
        onUpdateDataset={handleUpdate}
        onEditDataset={() => undefined}
        onDeleteDataset={() => undefined}
        onDuplicateDataset={() => undefined}
        onSelectTrace={() => undefined}
      />
    );
  };
}

export const Overview: Story = {
  render: Wrapper({ snapshot: trainingDatasetSnapshot, defaultTab: "overview" }),
};

export const TracesTab: Story = {
  render: Wrapper({ snapshot: trainingDatasetSnapshot, defaultTab: "traces" }),
};

export const ClustersTab: Story = {
  render: Wrapper({ snapshot: trainingDatasetSnapshot, defaultTab: "clusters" }),
};

export const GraphTab: Story = {
  render: Wrapper({ snapshot: trainingDatasetSnapshot, defaultTab: "graph" }),
};

export const TimelineTab: Story = {
  render: Wrapper({ snapshot: trainingDatasetSnapshot, defaultTab: "timeline" }),
};

export const EvalSnapshot: Story = {
  render: Wrapper({ snapshot: evalDatasetSnapshot, defaultTab: "overview" }),
};

export const FewTraces: Story = {
  render: Wrapper({ snapshot: reviewDatasetSnapshot, defaultTab: "traces" }),
};

export const EmptyDataset: Story = {
  render: Wrapper({ snapshot: emptyDatasetSnapshot, defaultTab: "overview" }),
};
