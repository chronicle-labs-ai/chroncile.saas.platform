import type { Meta, StoryObj } from "@storybook/react";

import { OptionTile } from "./option-tile";

const meta = {
  title: "Primitives/OptionTile",
  component: OptionTile,
  parameters: { layout: "centered" },
  argTypes: {
    label: { control: "text" },
    meta: { control: "text" },
    rightTag: { control: "text" },
    isSelected: { control: "boolean" },
    disabled: { control: "boolean" },
  },
  args: {
    label: "Fresh database",
    meta: "Create an isolated Postgres cluster and seed from template",
    rightTag: "recommended",
    isSelected: true,
  },
} satisfies Meta<typeof OptionTile>;

export default meta;
type Story = StoryObj<typeof OptionTile>;

function OptionTileDemo() {
  return (
    <div className="grid max-w-[560px] gap-s-2">
      <OptionTile
        label="Fresh database"
        meta="Create an isolated Postgres cluster and seed from template"
        rightTag="recommended"
        isSelected
      />
      <OptionTile
        label="Clone staging"
        meta="Snapshot staging data into the ephemeral environment"
        rightTag="fast"
      />
      <OptionTile label="No database" meta="Frontend-only preview" />
    </div>
  );
}

export const Default: Story = {
  render: (args) => (
    <div className="w-[560px]">
      <OptionTile {...args} />
    </div>
  ),
};

export const Options: Story = {
  render: () => <OptionTileDemo />,
};
