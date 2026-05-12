import type { Meta, StoryObj } from "@storybook/react";

import { ProductChip, ProductTableAction } from "./product-chip";

const meta = {
  title: "Product/ProductChip",
  component: ProductChip,
  parameters: { layout: "centered" },
  argTypes: {
    tone: {
      control: "select",
      options: ["neutral", "data", "caution", "nominal", "critical"],
    },
    dot: { control: "boolean" },
    children: { control: "text" },
  },
  args: {
    tone: "data",
    dot: true,
    children: "published",
  },
} satisfies Meta<typeof ProductChip>;

export default meta;
type Story = StoryObj<typeof ProductChip>;

export const Default: Story = {};

export const Tones: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-s-2">
      <ProductChip>default</ProductChip>
      <ProductChip tone="data">data</ProductChip>
      <ProductChip tone="caution">draft</ProductChip>
      <ProductChip tone="nominal">published</ProductChip>
      <ProductChip tone="critical">delete</ProductChip>
    </div>
  ),
};

export const TableActions: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-s-2">
      <ProductTableAction tone="data">Preview</ProductTableAction>
      <ProductTableAction tone="caution">Send Test</ProductTableAction>
      <ProductTableAction tone="critical">Delete</ProductTableAction>
    </div>
  ),
};
