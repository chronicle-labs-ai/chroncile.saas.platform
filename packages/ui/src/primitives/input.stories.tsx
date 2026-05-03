import type { Meta, StoryObj } from "@storybook/react";
import { Input } from "./input";

const meta: Meta<typeof Input> = {
  title: "Primitives/Input",
  component: Input,
  parameters: { layout: "padded" },
  args: {
    placeholder: "topic:support.* OR shopify.order.*",
  },
};
export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  render: (args) => (
    <div className="w-[420px]">
      <Input {...args} />
    </div>
  ),
};

export const Search: Story = {
  args: { search: true, placeholder: "Search events…" },
  render: (args) => (
    <div className="w-[420px]">
      <Input {...args} />
    </div>
  ),
};

export const Invalid: Story = {
  args: { invalid: true, defaultValue: "malformed-query" },
  render: (args) => (
    <div className="w-[420px]">
      <Input {...args} />
    </div>
  ),
};

export const Auth: Story = {
  args: { variant: "auth", placeholder: "you@chronicle.io" },
  render: (args) => (
    <div className="w-[420px]">
      <Input {...args} />
    </div>
  ),
};
