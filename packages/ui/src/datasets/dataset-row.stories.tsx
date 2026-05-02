import type { Meta, StoryObj } from "@storybook/react";

import { datasetsManagerSeed } from "./data";
import { DatasetRow } from "./dataset-row";
import { ProductChromeFrame } from "./_story-frame";

const meta: Meta<typeof DatasetRow> = {
  title: "Datasets/DatasetRow",
  component: DatasetRow,
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
type Story = StoryObj<typeof DatasetRow>;

const evalDataset = datasetsManagerSeed.find((d) => d.purpose === "eval")!;
const trainingDataset = datasetsManagerSeed.find((d) => d.purpose === "training")!;

export const Default: Story = {
  args: {
    dataset: evalDataset,
    onOpen: () => undefined,
  },
};

export const Active: Story = {
  args: {
    dataset: evalDataset,
    onOpen: () => undefined,
    isActive: true,
  },
};

export const NoDescription: Story = {
  args: {
    dataset: {
      ...trainingDataset,
      description: undefined,
    },
    onOpen: () => undefined,
  },
};

export const Stack: Story = {
  render: () => (
    <>
      {datasetsManagerSeed.map((dataset, i) => (
        <DatasetRow
          key={dataset.id}
          dataset={dataset}
          isActive={i === 1}
          onOpen={() => undefined}
        />
      ))}
    </>
  ),
};
