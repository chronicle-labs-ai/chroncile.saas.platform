import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "../primitives/button";

import { datasetsManagerSeed } from "./data";
import { DatasetEditDialog } from "./dataset-edit-dialog";
import { ProductChromeFrame } from "./_story-frame";
import type { Dataset } from "./types";

const meta: Meta<typeof DatasetEditDialog> = {
  title: "Datasets/DatasetEditDialog",
  component: DatasetEditDialog,
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
type Story = StoryObj<typeof DatasetEditDialog>;

const trainingDataset = datasetsManagerSeed.find(
  (d) => d.purpose === "training",
)!;

export const Default: Story = {
  render: function Render() {
    const [open, setOpen] = React.useState(true);
    const [updated, setUpdated] = React.useState<Dataset | null>(null);
    return (
      <div className="flex flex-col gap-3">
        <Button variant="primary" onPress={() => setOpen(true)}>
          Open edit dialog
        </Button>
        {updated ? (
          <pre className="max-w-md overflow-x-auto rounded-[3px] border border-hairline-strong bg-l-surface-raised p-3 font-mono text-[11px] text-l-ink-lo">
            {JSON.stringify(updated, null, 2)}
          </pre>
        ) : null}
        <DatasetEditDialog
          dataset={trainingDataset}
          isOpen={open}
          onOpenChange={setOpen}
          onUpdate={({ id, patch }) => {
            const next = { ...trainingDataset, id, ...patch };
            setUpdated(next);
            return next;
          }}
        />
      </div>
    );
  },
};

export const NoChanges: Story = {
  render: function Render() {
    const [open, setOpen] = React.useState(true);
    return (
      <DatasetEditDialog
        dataset={trainingDataset}
        isOpen={open}
        onOpenChange={setOpen}
      />
    );
  },
};

export const TagsHeavy: Story = {
  render: function Render() {
    const [open, setOpen] = React.useState(true);
    const heavyDataset: Dataset = {
      ...trainingDataset,
      tags: [
        "regression",
        "support",
        "billing",
        "api",
        "auth",
        "longtail",
        "fork",
      ],
    };
    return (
      <DatasetEditDialog
        dataset={heavyDataset}
        isOpen={open}
        onOpenChange={setOpen}
      />
    );
  },
};
