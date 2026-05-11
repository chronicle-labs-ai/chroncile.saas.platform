import type { Meta, StoryObj } from "@storybook/react";
import { ProgressBar } from "./progress-bar";

const meta: Meta<typeof ProgressBar> = {
  title: "Primitives/ProgressBar",
  component: ProgressBar,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof ProgressBar>;

export const Determinate: Story = {
  render: () => (
    <div className="w-[360px] flex flex-col gap-s-4">
      <ProgressBar label="Processing" value={42} />
      <ProgressBar label="Uploading" value={80} />
    </div>
  ),
};

export const Indeterminate: Story = {
  render: () => (
    <div className="w-[360px]">
      <ProgressBar label="Loading" isIndeterminate />
    </div>
  ),
};
