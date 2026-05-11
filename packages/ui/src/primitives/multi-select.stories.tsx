import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";

import { MultiSelect, type MultiSelectItemType } from "./multi-select";

const environments: MultiSelectItemType[] = [
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

const meta: Meta<typeof MultiSelect> = {
  title: "Primitives/MultiSelect",
  component: MultiSelect,
  parameters: { layout: "centered" },
  args: {
    items: environments,
    label: "Assignments",
    placeholder: "Select environments",
    defaultSelectedKeys: ["default", "production"],
  },
  decorators: [
    (Story) => (
      <div className="w-[360px]">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof MultiSelect>;

export const Default: Story = {};

export const CustomCount: Story = {
  args: {
    selectedCountFormatter: (count) =>
      count === 1 ? "1 environment" : `${count} environments`,
    supportingText: "assigned",
  },
};

export const WithoutFooter: Story = {
  args: {
    showFooter: false,
  },
};

export const EmptySearch: Story = {
  args: {
    defaultSelectedKeys: [],
    emptyStateTitle: "No environments found",
    emptyStateDescription: "Try searching by deployment or domain.",
  },
  render: (args) => {
    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    return (
      <MultiSelect
        {...args}
        selectedKeys={selected}
        onSelectionChange={setSelected}
        searchPlaceholder="Search zz..."
      />
    );
  },
};

export const LightMode: Story = {
  render: (args) => (
    <div data-theme="light" className="rounded-md bg-page p-s-6">
      <MultiSelect {...args} />
    </div>
  ),
};
