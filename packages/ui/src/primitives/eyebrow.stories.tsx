import type { Meta, StoryObj } from "@storybook/react";
import { Eyebrow } from "./eyebrow";

const meta: Meta<typeof Eyebrow> = {
  title: "Primitives/Eyebrow",
  component: Eyebrow,
  parameters: { layout: "centered" },
  args: { children: "CHRONICLE / BRAND & PRODUCT SYSTEM · v0.1 DRAFT" },
};
export default meta;
type Story = StoryObj<typeof Eyebrow>;

export const Default: Story = {};
