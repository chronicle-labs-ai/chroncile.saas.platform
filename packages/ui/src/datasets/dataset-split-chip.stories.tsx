import type { Meta, StoryObj } from "@storybook/react";

import { DatasetSplitChip } from "./dataset-split-chip";
import { ProductChromeFrame } from "./_story-frame";

const meta: Meta<typeof DatasetSplitChip> = {
  title: "Datasets/DatasetSplitChip",
  component: DatasetSplitChip,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="md">
        <div className="flex items-center gap-2">
          <Story />
        </div>
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof DatasetSplitChip>;

export const Train: Story = { args: { split: "train" } };
export const Validation: Story = { args: { split: "validation" } };
export const Test: Story = { args: { split: "test" } };
export const Compact: Story = { args: { split: "train", compact: true } };

export const All: Story = {
  render: () => (
    <>
      <DatasetSplitChip split="train" />
      <DatasetSplitChip split="validation" />
      <DatasetSplitChip split="test" />
      <DatasetSplitChip split="train" compact />
      <DatasetSplitChip split="validation" compact />
      <DatasetSplitChip split="test" compact />
    </>
  ),
};
