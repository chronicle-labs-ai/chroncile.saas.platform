import type { Meta, StoryObj } from "@storybook/react";
import { Tag, type TagVariant } from "./tag";

const all: TagVariant[] = [
  "neutral",
  "ember",
  "teal",
  "amber",
  "green",
  "orange",
  "pink",
  "violet",
  "red",
];

const meta: Meta<typeof Tag> = {
  title: "Primitives/Tag",
  component: Tag,
  parameters: { layout: "centered" },
  args: { variant: "teal", children: "CUSTOMER" },
};
export default meta;
type Story = StoryObj<typeof Tag>;

export const Default: Story = {};
export const Roles: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-s-3">
      <Tag variant="teal">CUSTOMER</Tag>
      <Tag variant="amber">AGENT</Tag>
      <Tag variant="green">SYSTEM</Tag>
      <Tag variant="red">DIVERGENCE</Tag>
    </div>
  ),
};
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-s-3">
      {all.map((v) => (
        <Tag key={v} variant={v}>
          {v.toUpperCase()}
        </Tag>
      ))}
    </div>
  ),
};
