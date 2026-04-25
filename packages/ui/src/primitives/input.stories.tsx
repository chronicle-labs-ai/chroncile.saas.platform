import type { Meta, StoryObj } from "@storybook/react";
import { Input } from "./input";

const meta: Meta<typeof Input> = {
  title: "Primitives/Input",
  component: Input,
  parameters: { layout: "padded" },
  argTypes: {
    density: { control: "radio", options: ["compact", "brand"] },
  },
  args: {
    density: "compact",
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

export const DensityCompare: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-s-8">
      <div className="flex flex-col gap-s-2">
        <span className="font-mono text-mono-sm uppercase tracking-eyebrow text-l-ink-dim">
          {`density="compact"`}
        </span>
        <Input placeholder="Filter by topic or trace_id" />
        <Input search placeholder="Search events…" />
      </div>
      <div className="flex flex-col gap-s-2">
        <span className="font-mono text-mono-sm uppercase tracking-eyebrow text-ink-dim">
          {`density="brand"`}
        </span>
        <Input density="brand" placeholder="topic:support.*" />
        <Input density="brand" search placeholder="Search events…" />
      </div>
    </div>
  ),
};
