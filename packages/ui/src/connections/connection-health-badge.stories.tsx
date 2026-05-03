import type { Meta, StoryObj } from "@storybook/react";

import { ConnectionHealthBadge } from "./connection-health-badge";
import { type ConnectionHealth } from "./data";

const ALL: ConnectionHealth[] = [
  "live",
  "paused",
  "error",
  "expired",
  "testing",
  "disconnected",
];

const meta: Meta<typeof ConnectionHealthBadge> = {
  title: "Connections/ConnectionHealthBadge",
  component: ConnectionHealthBadge,
  parameters: { layout: "centered" },
  argTypes: {
    health: { control: "radio", options: ALL },
    size: { control: "radio", options: ["sm", "md"] },
    iconOnly: { control: "boolean" },
    pulse: {
      control: "radio",
      options: ["default", true, false],
      mapping: { default: undefined, true: true, false: false },
      description:
        "Defaults to `live`-only. Pass `true` to opt-in for testing/error in isolated surfaces (header strips), or `false` to suppress.",
    },
  },
  args: { health: "live", size: "md", iconOnly: false, pulse: undefined },
};
export default meta;
type Story = StoryObj<typeof ConnectionHealthBadge>;

/**
 * Default — single badge driven by the controls panel. Use this story to
 * iterate on tone, size, and the pulse override.
 */
export const Playground: Story = {};

/**
 * All states — every member of `ConnectionHealth` rendered at the default
 * size. Stable order matches the toolbar filter chips. Only `live`
 * pulses by default; `error` is loud but static so a list of errored
 * rows doesn't become 18 concurrent animations (Emil rule:
 * frequency-aware motion).
 */
export const All: Story = {
  render: () => (
    <div className="flex flex-col gap-3 p-6">
      {ALL.map((h) => (
        <ConnectionHealthBadge key={h} health={h} />
      ))}
    </div>
  ),
};

/**
 * Icon-only — renders just the dot. Use inside the toolbar's filter
 * chips and any tight context where the label would crowd the layout.
 */
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

/**
 * Small size — used inside `ConnectionRow` and `ConnectionCard`. Keep
 * the visual weight under the row's name typography.
 */
export const Small: Story = {
  render: () => (
    <div className="flex flex-col gap-2 p-6">
      {ALL.map((h) => (
        <ConnectionHealthBadge key={h} health={h} size="sm" />
      ))}
    </div>
  ),
};

/**
 * Pulse opt-in — same six states with `pulse={true}` forced everywhere.
 * Useful for seeing what the loud variant looks like before deciding
 * where it earns its keep.
 */
export const PulseAll: Story = {
  render: () => (
    <div className="flex flex-col gap-3 p-6">
      {ALL.map((h) => (
        <ConnectionHealthBadge key={h} health={h} pulse />
      ))}
    </div>
  ),
};
