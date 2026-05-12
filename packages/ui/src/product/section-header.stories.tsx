import type { Meta, StoryObj } from "@storybook/react";
import { SectionHeader } from "./section-header";

const meta: Meta<typeof SectionHeader> = {
  title: "Product/SectionHeader",
  component: SectionHeader,
  parameters: { layout: "padded" },
  args: { title: "Product system", note: "05 — 07 · COMPONENTS → APP" },
};
export default meta;
type Story = StoryObj<typeof SectionHeader>;

export const Default: Story = {};
