import type { Meta, StoryObj } from "@storybook/react";
import { Tooltip } from "./tooltip";
import { Button } from "./button";

const meta: Meta<typeof Tooltip> = {
  title: "Primitives/Tooltip",
  component: Tooltip,
  parameters: { layout: "centered" },
};
export default meta;
type Story = StoryObj<typeof Tooltip>;

export const Default: Story = {
  render: () => (
    <Tooltip content="Save changes" placement="top">
      <Button variant="ghost">Save</Button>
    </Tooltip>
  ),
};

export const WithArrow: Story = {
  render: () => (
    <Tooltip content="Deploy target" placement="bottom" showArrow>
      <Button variant="secondary">Deploy</Button>
    </Tooltip>
  ),
};
