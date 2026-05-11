import type { Meta, StoryObj } from "@storybook/react";

import { datasetsManagerSeed } from "./data";
import { DatasetCard } from "./dataset-card";
import { ProductChromeFrame } from "./_story-frame";

const meta: Meta<typeof DatasetCard> = {
  title: "Datasets/DatasetCard",
  component: DatasetCard,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="md" maxWidth="360px">
        <Story />
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof DatasetCard>;

const evalDataset = datasetsManagerSeed.find((d) => d.purpose === "eval")!;
const trainingDataset = datasetsManagerSeed.find((d) => d.purpose === "training")!;
const replayDataset = datasetsManagerSeed.find((d) => d.purpose === "replay")!;
const reviewDataset = datasetsManagerSeed.find((d) => d.purpose === "review")!;

export const Eval: Story = {
  args: {
    dataset: evalDataset,
    onOpen: () => undefined,
  },
};

export const Training: Story = {
  args: {
    dataset: trainingDataset,
    onOpen: () => undefined,
  },
};

export const Replay: Story = {
  args: {
    dataset: replayDataset,
    onOpen: () => undefined,
  },
};

export const Review: Story = {
  args: {
    dataset: reviewDataset,
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

export const Untagged: Story = {
  args: {
    dataset: {
      ...evalDataset,
      tags: undefined,
      description: undefined,
    },
    onOpen: () => undefined,
  },
};
