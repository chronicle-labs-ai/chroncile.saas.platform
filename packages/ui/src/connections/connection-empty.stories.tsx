import type { Meta, StoryObj } from "@storybook/react";

import { ConnectionEmpty } from "./connection-empty";

const meta: Meta<typeof ConnectionEmpty> = {
  title: "Connections/ConnectionEmpty",
  component: ConnectionEmpty,
  parameters: { layout: "centered" },
};
export default meta;
type Story = StoryObj<typeof ConnectionEmpty>;

export const Empty: Story = {
  render: () => (
    <div className="w-[680px] bg-background p-6">
      <ConnectionEmpty onAdd={() => console.log("add")} />
    </div>
  ),
};

export const Filtered: Story = {
  render: () => (
    <div className="w-[680px] bg-background p-6">
      <ConnectionEmpty
        variant="filtered"
        onClearFilters={() => console.log("clear filters")}
      />
    </div>
  ),
};
