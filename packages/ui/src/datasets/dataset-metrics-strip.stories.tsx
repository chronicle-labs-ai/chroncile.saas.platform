import type { Meta, StoryObj } from "@storybook/react";

import {
  emptyDatasetSnapshot,
  evalDatasetSnapshot,
  trainingDatasetSnapshot,
} from "./data";
import { DatasetMetricsStrip } from "./dataset-metrics-strip";
import { ProductChromeFrame } from "./_story-frame";

const meta: Meta<typeof DatasetMetricsStrip> = {
  title: "Datasets/DatasetMetricsStrip",
  component: DatasetMetricsStrip,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="md" maxWidth="900px">
        <Story />
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof DatasetMetricsStrip>;

export const Default: Story = {
  args: { snapshot: trainingDatasetSnapshot },
};

export const Eval: Story = {
  args: { snapshot: evalDatasetSnapshot },
};

export const EmptyDataset: Story = {
  args: { snapshot: emptyDatasetSnapshot },
};
