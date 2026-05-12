import type { Meta, StoryObj } from "@storybook/react";

import { KvGrid } from "./kv-grid";

const meta = {
  title: "Primitives/KvGrid",
  component: KvGrid,
  parameters: { layout: "centered" },
  argTypes: {
    items: { control: "object" },
    labelWidthClassName: { control: "text" },
  },
} satisfies Meta<typeof KvGrid>;

export default meta;
type Story = StoryObj<typeof KvGrid>;

const items = [
  { label: "Fly App", value: "chronicle-pr-1276" },
  { label: "Region", value: "iad" },
  { label: "Branch", value: "feature/env-manager-redesign" },
  { label: "Database", value: "postgres://internal/chronicle_pr_1276" },
];

function KvGridDemo() {
  return (
    <div className="max-w-[520px] rounded-md border border-hairline bg-surface-01 p-s-5">
      <KvGrid items={items} />
    </div>
  );
}

export const Default: Story = {
  args: { items },
};

export const Panel: Story = {
  render: () => <KvGridDemo />,
};
