import type { Meta, StoryObj } from "@storybook/react";

import { DatasetsManager } from "./datasets-manager";
import { ProductChromeFrame } from "./_story-frame";

const meta: Meta<typeof DatasetsManager> = {
  title: "Datasets/DatasetsManager",
  component: DatasetsManager,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <ProductChromeFrame padding="none">
        <Story />
      </ProductChromeFrame>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof DatasetsManager>;

export const Default: Story = {};

export const ListView: Story = {
  args: { initialView: "list" },
};

export const GridView: Story = {
  args: { initialView: "grid" },
};

export const EmptyAll: Story = {
  args: { datasets: [] },
};
