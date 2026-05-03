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
          <div className="flex flex-1 min-h-0 flex-col rounded-[4px] border border-hairline-strong bg-l-surface-raised">
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
  defaultLens,
}: {
  snapshot: DatasetSnapshot;
  defaultLens?: React.ComponentProps<typeof DatasetDetailPage>["defaultLens"];
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
        defaultLens={defaultLens}
        onUpdateDataset={handleUpdate}
        onEditDataset={() => undefined}
        onDeleteDataset={() => undefined}
        onDuplicateDataset={() => undefined}
        onSelectTrace={() => undefined}
      />
    );
  };
}

/* The default lens — table view with cluster grouping. */
export const ListLens: Story = {
  render: Wrapper({ snapshot: trainingDatasetSnapshot, defaultLens: "list" }),
};

export const GraphLens: Story = {
  render: Wrapper({ snapshot: trainingDatasetSnapshot, defaultLens: "graph" }),
};

export const TimelineLens: Story = {
  render: Wrapper({ snapshot: trainingDatasetSnapshot, defaultLens: "timeline" }),
};

export const CoverageLens: Story = {
  render: Wrapper({ snapshot: trainingDatasetSnapshot, defaultLens: "coverage" }),
};

export const EvalSnapshot: Story = {
  render: Wrapper({ snapshot: evalDatasetSnapshot, defaultLens: "list" }),
};

export const FewTraces: Story = {
  render: Wrapper({ snapshot: reviewDatasetSnapshot, defaultLens: "list" }),
};

export const EmptyDataset: Story = {
  render: Wrapper({ snapshot: emptyDatasetSnapshot, defaultLens: "list" }),
};
