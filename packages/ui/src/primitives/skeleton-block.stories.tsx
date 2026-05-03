import type { Meta, StoryObj } from "@storybook/react";
import { SkeletonBlock } from "./skeleton-block";

const meta: Meta<typeof SkeletonBlock> = {
  title: "Primitives/SkeletonBlock",
  component: SkeletonBlock,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof SkeletonBlock>;

export const Default: Story = {
  render: () => (
    <div className="flex flex-col gap-s-3 w-[420px]">
      <SkeletonBlock className="h-[24px] w-3/4" />
      <SkeletonBlock className="h-[14px] w-full" />
      <SkeletonBlock className="h-[14px] w-5/6" />
      <SkeletonBlock className="h-[14px] w-2/3" />
    </div>
  ),
};
