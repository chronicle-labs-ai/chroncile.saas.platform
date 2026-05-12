import type { Meta, StoryObj } from "@storybook/react";
import { Body } from "./body";

const meta: Meta<typeof Body> = {
  title: "Typography/Body",
  component: Body,
  parameters: { layout: "padded" },
  args: {
    size: "md",
    tone: "default",
    children:
      "A unified design language for Chronicle — serif headlines for authority, mono for time and topics, sans for reading.",
  },
};
export default meta;
type Story = StoryObj<typeof Body>;
export const Default: Story = {};
