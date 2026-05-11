import type { Meta, StoryObj } from "@storybook/react";

import { ScrollArea } from "./scroll-area";

const meta: Meta<typeof ScrollArea> = {
  title: "Primitives/ScrollArea",
  component: ScrollArea,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof ScrollArea>;

const lines = Array.from({ length: 60 }, (_, i) => `Line ${i + 1}`);

export const Vertical: Story = {
  render: () => (
    <ScrollArea className="h-[260px] w-[320px] rounded-md border border-hairline bg-l-surface-raised">
      <div className="p-[12px]">
        <h4 className="mb-s-2 font-sans text-[12px] font-medium text-l-ink-dim">
          Recent traces
        </h4>
        <ul className="flex flex-col gap-[6px] font-sans text-[13px] text-l-ink-lo">
          {lines.map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>
      </div>
    </ScrollArea>
  ),
};

export const Horizontal: Story = {
  render: () => (
    <ScrollArea className="w-[420px] whitespace-nowrap rounded-md border border-hairline bg-l-surface-raised">
      <div className="flex gap-[8px] p-[12px]">
        {Array.from({ length: 16 }, (_, i) => (
          <div
            key={i}
            className="inline-flex h-[80px] w-[120px] shrink-0 items-center justify-center rounded-md border border-hairline-strong bg-surface-02 font-mono text-[11px] text-l-ink-dim"
          >
            tile {i + 1}
          </div>
        ))}
      </div>
    </ScrollArea>
  ),
};
