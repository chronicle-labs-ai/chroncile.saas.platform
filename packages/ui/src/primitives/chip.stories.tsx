import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { Chip } from "./chip";

const meta: Meta<typeof Chip> = {
  title: "Primitives/Chip",
  component: Chip,
  parameters: { layout: "centered" },
  args: { children: "Outcome" },
};
export default meta;
type Story = StoryObj<typeof Chip>;

const ChevronDown = () => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M4 6l4 4 4-4" />
  </svg>
);
const Plus = () => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    aria-hidden
  >
    <path d="M8 3v10M3 8h10" />
  </svg>
);

export const Default: Story = {};

export const Active: Story = {
  args: { active: true, count: 2, children: "Outcome" },
};

export const States: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-s-2">
      <Chip icon={<ChevronDown />}>Outcome</Chip>
      <Chip icon={<ChevronDown />} active count={2}>
        Priority
      </Chip>
      <Chip icon={<ChevronDown />} active count={1} removable>
        Customer: Acme
      </Chip>
      <Chip icon={<Plus />}>Add filter</Chip>
    </div>
  ),
};

export const InFilterBar: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="flex items-center gap-s-2 border-y border-hairline-strong bg-l-surface-bar px-s-3 py-[6px]">
      <span className="font-mono text-[10.5px] uppercase tracking-eyebrow text-l-ink-dim px-[4px]">
        Filter
      </span>
      <Chip icon={<ChevronDown />} active count={2}>
        Outcome
      </Chip>
      <Chip icon={<ChevronDown />} active count={1}>
        Priority
      </Chip>
      <Chip icon={<Plus />}>Add filter</Chip>
    </div>
  ),
};
