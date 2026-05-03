import type { Meta, StoryObj } from "@storybook/react";

import { AgentsManager } from "./agents-manager";
import { ProductChromeFrame } from "./_story-frame";

const meta: Meta<typeof AgentsManager> = {
  title: "Agents/AgentsManager",
  component: AgentsManager,
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
type Story = StoryObj<typeof AgentsManager>;

export const Default: Story = {};

export const ListView: Story = {
  args: { initialView: "list" },
};

export const GridView: Story = {
  args: { initialView: "grid" },
};

export const GroupByPurpose: Story = {
  args: { initialGroupBy: "purpose", initialView: "grid" },
};

export const GroupByFramework: Story = {
  args: { initialGroupBy: "framework", initialView: "grid" },
};

export const Flat: Story = {
  args: { initialGroupBy: "flat", initialView: "grid" },
};

export const FlatList: Story = {
  args: { initialGroupBy: "flat", initialView: "list" },
};

export const EmptyAll: Story = {
  args: { agents: [] },
};
