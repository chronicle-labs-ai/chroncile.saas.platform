import type { Meta, StoryObj } from "@storybook/react";
import { Slider } from "./slider";

const meta: Meta = {
  title: "Primitives/Slider",
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj;

export const Single: Story = {
  render: () => (
    <div className="w-[360px]">
      <Slider
        aria-label="Confidence"
        defaultValue={72}
        minValue={0}
        maxValue={100}
      />
    </div>
  ),
};

export const Range: Story = {
  render: () => (
    <div className="w-[360px]">
      <Slider<number[]>
        aria-label="Latency window"
        defaultValue={[20, 80]}
        minValue={0}
        maxValue={100}
      />
    </div>
  ),
};
