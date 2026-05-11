import type { Meta, StoryObj } from "@storybook/react";
import { Label, type LabelColor } from "./label";

const colors: LabelColor[] = [
  "neutral",
  "teal",
  "amber",
  "green",
  "orange",
  "pink",
  "violet",
  "ember",
  "red",
];

const meta: Meta<typeof Label> = {
  title: "Primitives/Label",
  component: Label,
  parameters: { layout: "centered" },
  args: { color: "teal", children: "intercom" },
};
export default meta;
type Story = StoryObj<typeof Label>;

export const Default: Story = {};

export const AllColors: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-s-2">
      {colors.map((c) => (
        <Label key={c} color={c}>
          {c}
        </Label>
      ))}
    </div>
  ),
};

export const InRow: Story = {
  render: () => (
    <div className="flex items-center gap-s-3 font-mono text-[12px] text-l-ink">
      <span className="text-l-ink-dim">CHR-412</span>
      <span>Agent escalates on shipping_error</span>
      <Label color="teal">intercom</Label>
      <Label color="ember">divergence</Label>
    </div>
  ),
};
