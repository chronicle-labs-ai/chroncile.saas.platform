import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";

import { ConnectionCard } from "./connection-card";
import { connectionsSeed, type Connection } from "./data";

const meta: Meta<typeof ConnectionCard> = {
  title: "Connections/ConnectionCard",
  component: ConnectionCard,
  parameters: { layout: "fullscreen" },
  args: {
    connection: connectionsSeed[0],
    isActive: false,
    onOpen: fn(),
    onPause: fn(),
    onResume: fn(),
    onReauth: fn(),
    onTest: fn(),
    onSettings: fn(),
    onDisconnect: fn(),
  },
  argTypes: {
    isActive: { control: "boolean" },
    connection: { control: false },
  },
};
export default meta;
type Story = StoryObj<typeof ConnectionCard>;

/**
 * Playground — a single card driven by the Controls panel. Tweak
 * `isActive` to preview the master/detail focus tone.
 */
export const Playground: Story = {
  render: (args) => (
    <div className="bg-page p-6">
      <div className="max-w-[360px]">
        <ConnectionCard {...args} />
      </div>
    </div>
  ),
};

/**
 * Grid — all six connections rendered in the dashboard's 1/2/3-col
 * grid. Same handler instances flow through `fn()` so Storybook's
 * Actions panel records every interaction.
 */
export const Grid: Story = {
  render: (args) => (
    <div className="bg-page p-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {connectionsSeed.map((c) => (
          <ConnectionCard {...args} key={c.id} connection={c} />
        ))}
      </div>
    </div>
  ),
};

/**
 * Active — three cards with the middle one toned as the active row in
 * the master/detail layout.
 */
export const Active: Story = {
  render: (args) => (
    <div className="bg-page p-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {connectionsSeed.slice(0, 3).map((c, i) => (
          <ConnectionCard
            {...args}
            key={c.id}
            connection={c}
            isActive={i === 1}
          />
        ))}
      </div>
    </div>
  ),
};

/**
 * Wide grid — the seed repeated to a 12-card wall. Use to verify hover
 * and focus rings never bleed across rows, and that the grid wraps
 * cleanly at the `sm` and `xl` breakpoints.
 */
export const WideGrid: Story = {
  render: (args) => {
    const wide: Connection[] = Array.from({ length: 12 }).map((_, i) => {
      const base = connectionsSeed[i % connectionsSeed.length]!;
      return {
        ...base,
        id: `${base.id}_grid_${i}`,
        name: `${base.name} ${String.fromCharCode(65 + (i % 26))}`,
      };
    });
    return (
      <div className="bg-page p-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {wide.map((c) => (
            <ConnectionCard {...args} key={c.id} connection={c} />
          ))}
        </div>
      </div>
    );
  },
};
