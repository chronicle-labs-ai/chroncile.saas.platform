import type { Meta, StoryObj } from "@storybook/react";
import { Badge, type BadgeVariant } from "./badge";

const allVariants: BadgeVariant[] = [
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

const meta: Meta<typeof Badge> = {
  title: "Primitives/Badge",
  component: Badge,
  parameters: { layout: "centered" },
  args: { variant: "neutral", children: "Neutral" },
};
export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-s-3">
      {allVariants.map((v) => (
        <Badge key={v} variant={v}>
          {v}
        </Badge>
      ))}
    </div>
  ),
};
