import type { Meta, StoryObj } from "@storybook/react";

import { ProductMultiSelect } from "./product-multi-select";

const options = [
  {
    id: "default",
    label: "Default",
    description: "Global fallback",
    section: "Fallback",
  },
  {
    id: "production",
    label: "production",
    description: "app.chroniclelabs.io",
    section: "Permanent environments",
  },
  {
    id: "staging",
    label: "staging",
    description: "chronicle-staging.vercel.app",
    section: "Permanent environments",
  },
  {
    id: "development",
    label: "development",
    description: "chronicle-dev.vercel.app",
    section: "Permanent environments",
  },
];

const meta = {
  title: "Product/ProductMultiSelect",
  component: ProductMultiSelect,
  parameters: { layout: "centered" },
  args: {
    options,
    defaultSelectedIds: ["default", "production"],
    searchPlaceholder: "Search environments...",
  },
} satisfies Meta<typeof ProductMultiSelect>;

export default meta;
type Story = StoryObj<typeof ProductMultiSelect>;

export const Default: Story = {
  render: (args) => (
    <div className="w-[360px]">
      <ProductMultiSelect {...args} />
    </div>
  ),
};

export const WithoutSearch: Story = {
  args: { searchable: false },
  render: (args) => (
    <div className="w-[360px]">
      <ProductMultiSelect {...args} />
    </div>
  ),
};
