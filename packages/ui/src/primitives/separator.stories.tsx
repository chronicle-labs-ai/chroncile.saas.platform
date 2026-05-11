import type { Meta, StoryObj } from "@storybook/react";
import { Separator } from "./separator";

const meta: Meta<typeof Separator> = {
  title: "Primitives/Separator",
  component: Separator,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof Separator>;

export const Horizontal: Story = {
  render: () => (
    <div className="w-[400px] font-sans text-[13px] text-l-ink-lo">
      <p>Section above</p>
      <Separator className="my-s-3" />
      <p>Section below</p>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div className="flex h-[80px] items-center font-sans text-[13px] text-l-ink-lo">
      <span>Left</span>
      <Separator orientation="vertical" className="mx-s-3" />
      <span>Center</span>
      <Separator orientation="vertical" className="mx-s-3" />
      <span>Right</span>
    </div>
  ),
};
