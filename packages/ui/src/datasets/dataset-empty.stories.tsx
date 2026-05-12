import type { Meta, StoryObj } from "@storybook/react";

import { DatasetEmpty } from "./dataset-empty";
import { ProductChromeFrame } from "./_story-frame";

const meta: Meta<typeof DatasetEmpty> = {
  title: "Datasets/DatasetEmpty",
  component: DatasetEmpty,
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
type Story = StoryObj<typeof DatasetEmpty>;

export const Empty: Story = {
  args: {
    variant: "empty",
    onCreate: () => undefined,
  },
};

export const Filtered: Story = {
  args: {
    variant: "filtered",
    onClearFilters: () => undefined,
  },
};

export const DetailEmpty: Story = {
  args: {
    variant: "detail",
  },
};
