import type { Meta, StoryObj } from "@storybook/react";
import { Textarea } from "./textarea";

const meta: Meta<typeof Textarea> = {
  title: "Primitives/Textarea",
  component: Textarea,
  parameters: { layout: "padded" },
  args: {
    placeholder: "Paste an event payload…",
  },
};
export default meta;
type Story = StoryObj<typeof Textarea>;

export const Default: Story = {
  render: (args) => (
    <div className="w-[520px]">
      <Textarea {...args} rows={6} />
    </div>
  ),
};
