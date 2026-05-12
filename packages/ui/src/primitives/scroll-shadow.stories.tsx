import type { Meta, StoryObj } from "@storybook/react";
import { ScrollShadow } from "./scroll-shadow";

const meta: Meta<typeof ScrollShadow> = {
  title: "Primitives/ScrollShadow",
  component: ScrollShadow,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof ScrollShadow>;

export const Vertical: Story = {
  render: () => (
    <div className="w-[320px]">
      <ScrollShadow
        orientation="vertical"
        containerClassName="max-h-[180px]"
        className="rounded-md border border-hairline bg-surface-01"
      >
        <div className="flex flex-col gap-s-1 p-s-4 text-body-sm text-ink-lo">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i}>Row {i + 1}</div>
          ))}
        </div>
      </ScrollShadow>
    </div>
  ),
};
