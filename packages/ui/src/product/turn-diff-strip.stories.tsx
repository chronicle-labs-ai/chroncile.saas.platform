import type { Meta, StoryObj } from "@storybook/react";
import { TurnDiffStrip } from "./turn-diff-strip";

const meta: Meta<typeof TurnDiffStrip> = {
  title: "Product/TurnDiffStrip",
  component: TurnDiffStrip,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof TurnDiffStrip>;

export const Divergence: Story = {
  render: () => (
    <div className="w-[520px]">
      <TurnDiffStrip
        turns={[
          "hit",
          "hit",
          "hit",
          "hit",
          "miss",
          "hit",
          "miss",
          "empty",
          "empty",
          "empty",
          "empty",
        ]}
      />
    </div>
  ),
};
