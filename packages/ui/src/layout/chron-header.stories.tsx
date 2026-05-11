import type { Meta, StoryObj } from "@storybook/react";
import { ChronHeader } from "./chron-header";

const meta: Meta<typeof ChronHeader> = {
  title: "Layout/ChronHeader",
  component: ChronHeader,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof ChronHeader>;
export const Default: Story = { render: () => <ChronHeader /> };
