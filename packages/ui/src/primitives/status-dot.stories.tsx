import type { Meta, StoryObj } from "@storybook/react";
import { StatusDot, type StatusDotVariant } from "./status-dot";

const all: StatusDotVariant[] = [
  "ember",
  "teal",
  "amber",
  "green",
  "orange",
  "pink",
  "violet",
  "red",
  "offline",
];

const meta: Meta<typeof StatusDot> = {
  title: "Primitives/StatusDot",
  component: StatusDot,
  parameters: { layout: "centered" },
  args: { variant: "green" },
};
export default meta;
type Story = StoryObj<typeof StatusDot>;

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-s-5">
      {all.map((v) => (
        <div key={v} className="flex items-center gap-s-2">
          <StatusDot variant={v} halo />
          <span className="font-mono text-mono-sm uppercase tracking-tactical text-ink-lo">
            {v}
          </span>
        </div>
      ))}
    </div>
  ),
};

export const PulsingLive: Story = {
  render: () => <span className="chron-status-live">LIVE · 1,248 ev/s</span>,
};
