import type { Meta, StoryObj } from "@storybook/react";
import { Priority, type PriorityLevel } from "./priority";

const levels: PriorityLevel[] = ["urgent", "high", "med", "low", "none"];

const meta: Meta<typeof Priority> = {
  title: "Primitives/Priority",
  component: Priority,
  parameters: { layout: "centered" },
  args: { level: "high" },
};
export default meta;
type Story = StoryObj<typeof Priority>;

export const Default: Story = {};

export const AllLevels: Story = {
  render: () => (
    <div className="flex items-center gap-s-5">
      {levels.map((l) => (
        <div key={l} className="flex flex-col items-center gap-s-2">
          <Priority level={l} />
          <span className="font-mono text-mono-sm uppercase tracking-tactical text-l-ink-dim">
            {l}
          </span>
        </div>
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-end gap-s-4">
      <Priority level="urgent" size={12} />
      <Priority level="urgent" size={16} />
      <Priority level="urgent" size={20} />
      <Priority level="urgent" size={28} />
    </div>
  ),
};
