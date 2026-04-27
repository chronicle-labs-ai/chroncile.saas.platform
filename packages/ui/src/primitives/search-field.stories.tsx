import type { Meta, StoryObj } from "@storybook/react";
import { SearchField } from "./search-field";

const meta: Meta<typeof SearchField> = {
  title: "Primitives/SearchField",
  component: SearchField,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof SearchField>;

export const Default: Story = {
  render: () => (
    <div className="w-[360px]">
      <SearchField
        aria-label="Search"
        placeholder="Search runs, events, rules…"
      />
    </div>
  ),
};
