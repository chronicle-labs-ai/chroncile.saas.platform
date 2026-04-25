import type { Meta, StoryObj } from "@storybook/react";
import { Kbd } from "./kbd";

const meta: Meta<typeof Kbd> = {
  title: "Primitives/Kbd",
  component: Kbd,
  parameters: { layout: "centered" },
  args: { children: "K" },
};
export default meta;
type Story = StoryObj<typeof Kbd>;

export const Default: Story = {};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-s-3">
      <Kbd size="sm">⌘</Kbd>
      <Kbd size="sm">K</Kbd>
      <span className="font-mono text-mono text-l-ink-dim">·</span>
      <Kbd size="md">⌘</Kbd>
      <Kbd size="md">K</Kbd>
    </div>
  ),
};

export const InlineHint: Story = {
  render: () => (
    <span className="inline-flex items-center gap-s-2 font-sans text-[13px] text-l-ink">
      Search
      <span className="flex gap-[3px]">
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
      </span>
    </span>
  ),
};
