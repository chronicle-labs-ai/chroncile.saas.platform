import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";

import { ConnectionEmpty } from "./connection-empty";

const meta: Meta<typeof ConnectionEmpty> = {
  title: "Connections/ConnectionEmpty",
  component: ConnectionEmpty,
  parameters: { layout: "centered" },
  args: {
    variant: "empty",
    onAdd: fn(),
    onClearFilters: fn(),
  },
  argTypes: {
    variant: { control: "radio", options: ["empty", "filtered"] },
  },
};
export default meta;
type Story = StoryObj<typeof ConnectionEmpty>;

/**
 * Playground — switch between `empty` and `filtered` variants from the
 * Controls panel. Both render inside a 680px sleeve so the empty-state
 * proportions match the production list/grid container.
 */
export const Playground: Story = {
  render: (args) => (
    <div className="w-[680px] bg-page p-6">
      <ConnectionEmpty {...args} />
    </div>
  ),
};

/**
 * Empty — the post-onboarding zero state. Larger sizing, primary CTA
 * to wire up a first source. Used by `ConnectionsManager` when the
 * tenant has no rows at all.
 */
export const Empty: Story = {
  render: (args) => (
    <div className="w-[680px] bg-page p-6">
      <ConnectionEmpty {...args} variant="empty" />
    </div>
  ),
};

/**
 * Filtered — there are connections, but the active filters or search
 * query hide them all. Compact sizing, secondary "Clear filters" CTA.
 */
export const Filtered: Story = {
  render: (args) => (
    <div className="w-[680px] bg-page p-6">
      <ConnectionEmpty {...args} variant="filtered" />
    </div>
  ),
};
