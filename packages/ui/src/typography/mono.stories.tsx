import type { Meta, StoryObj } from "@storybook/react";
import { Mono } from "./mono";

const meta: Meta<typeof Mono> = {
  title: "Typography/Mono",
  component: Mono,
  parameters: { layout: "padded" },
  args: { size: "md", tone: "lo", children: "agent.tool.invoke → escalate()" },
};
export default meta;
type Story = StoryObj<typeof Mono>;
export const Default: Story = {};
export const Tactical: Story = {
  args: {
    tactical: true,
    uppercase: true,
    tone: "dim",
    children: "CHRONICLE · BRAND & PRODUCT SYSTEM",
  },
};
