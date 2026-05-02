import type { Meta, StoryObj } from "@storybook/react";

import { ConnectionHealthBadge } from "./connection-health-badge";
import { type ConnectionHealth } from "./data";

const meta: Meta<typeof ConnectionHealthBadge> = {
  title: "Connections/ConnectionHealthBadge",
  component: ConnectionHealthBadge,
  parameters: { layout: "centered" },
};
export default meta;
type Story = StoryObj<typeof ConnectionHealthBadge>;

const ALL: ConnectionHealth[] = [
  "live",
  "paused",
  "error",
  "expired",
  "testing",
  "disconnected",
];

export const All: Story = {
  render: () => (
    <div className="flex flex-col gap-3 p-6">
      {ALL.map((h) => (
        <ConnectionHealthBadge key={h} health={h} />
      ))}
    </div>
  ),
};

export const IconOnly: Story = {
  render: () => (
    <div className="flex flex-col gap-3 p-6">
      {ALL.map((h) => (
        <div key={h} className="flex items-center gap-3">
          <ConnectionHealthBadge health={h} iconOnly />
          <span className="font-mono text-mono-sm text-ink-dim">{h}</span>
        </div>
      ))}
    </div>
  ),
};

export const Small: Story = {
  render: () => (
    <div className="flex flex-col gap-2 p-6">
      {ALL.map((h) => (
        <ConnectionHealthBadge key={h} health={h} size="sm" />
      ))}
    </div>
  ),
};
