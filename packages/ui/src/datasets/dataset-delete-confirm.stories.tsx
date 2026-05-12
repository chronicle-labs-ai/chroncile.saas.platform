import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "../primitives/button";

import { datasetsManagerSeed } from "./data";
import { DatasetDeleteConfirm } from "./dataset-delete-confirm";
import { ProductChromeFrame } from "./_story-frame";
import type { Dataset } from "./types";

const meta: Meta<typeof DatasetDeleteConfirm> = {
  title: "Datasets/DatasetDeleteConfirm",
  component: DatasetDeleteConfirm,
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
type Story = StoryObj<typeof DatasetDeleteConfirm>;

const trainingDataset = datasetsManagerSeed.find(
  (d) => d.purpose === "training",
)!;

const emptyDataset: Dataset = {
  id: "ds_draft_empty",
  name: "Draft eval (empty)",
  description: "Newly created — no traces yet.",
  purpose: "eval",
  traceCount: 0,
  eventCount: 0,
  createdBy: "you",
  updatedAt: new Date().toISOString(),
};

export const EmptyDataset: Story = {
  render: function Render() {
    const [open, setOpen] = React.useState(true);
    return (
      <div className="flex flex-col gap-3">
        <Button variant="primary" onPress={() => setOpen(true)}>
          Open delete dialog
        </Button>
        <DatasetDeleteConfirm
          dataset={emptyDataset}
          isOpen={open}
          onOpenChange={setOpen}
          onDelete={() => undefined}
        />
      </div>
    );
  },
};

export const WithTraces: Story = {
  render: function Render() {
    const [open, setOpen] = React.useState(true);
    return (
      <div className="flex flex-col gap-3">
        <Button variant="primary" onPress={() => setOpen(true)}>
          Open delete dialog
        </Button>
        <DatasetDeleteConfirm
          dataset={trainingDataset}
          isOpen={open}
          onOpenChange={setOpen}
          onDelete={() => undefined}
        />
      </div>
    );
  },
};
