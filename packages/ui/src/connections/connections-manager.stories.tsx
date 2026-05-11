import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";

import { ConnectionsManager } from "./connections-manager";
import {
  connectionBackfillsSeed,
  connectionDeliveriesSeed,
  connectionEventSubsSeed,
  connectionsSeed,
  type Connection,
} from "./data";

const meta: Meta<typeof ConnectionsManager> = {
  title: "Connections/ConnectionsManager",
  component: ConnectionsManager,
  parameters: { layout: "fullscreen" },
  args: {
    backfillsByConnection: connectionBackfillsSeed,
    deliveriesByConnection: connectionDeliveriesSeed,
    eventSubsByConnection: connectionEventSubsSeed,
    onPause: fn(),
    onResume: fn(),
    onReauth: fn(),
    onTest: fn(),
    onDisconnect: fn(),
    onRotateSecret: fn(),
    onRunBackfill: fn(),
    onAdd: fn(),
    onChange: fn(),
    onOpenActivityLog: fn(),
  },
  argTypes: {
    initialView: { control: "radio", options: ["list", "grid"] },
    hideHeaderAdd: { control: "boolean" },
    workspace: { control: "text" },
  },
};
export default meta;
type Story = StoryObj<typeof ConnectionsManager>;

/**
 * Default — full surface with the seed data: 6 connections across the
 * health palette, backfill history, deliveries, and event subs all
 * wired up. Try opening a row to see the detail drawer, then hit
 * "Disconnect" to see the new confirmation modal in action.
 */
export const Default: Story = {
  render: (args) => (
    <div className="min-h-screen bg-page">
      <ConnectionsManager {...args} connections={connectionsSeed} />
    </div>
  ),
};

/**
 * Empty — no connections yet. Renders the `ConnectionEmpty` zero state
 * with the primary "Add your first connection" CTA. Confirms the
 * picker opens when the CTA is pressed.
 */
export const Empty: Story = {
  render: (args) => (
    <div className="min-h-screen bg-page">
      <ConnectionsManager {...args} connections={[]} />
    </div>
  ),
};

const mixedSet: Connection[] = [
  connectionsSeed.find((c) => c.id === "conn_intercom_01")!,
  connectionsSeed.find((c) => c.id === "conn_slack_01")!,
  connectionsSeed.find((c) => c.id === "conn_hubspot_01")!,
  connectionsSeed.find((c) => c.id === "conn_zendesk_01")!,
];

/**
 * Mixed — four connections in different health states. Useful for
 * sanity-checking that the toolbar's filter chips dim/light the right
 * rows.
 */
export const Mixed: Story = {
  render: (args) => (
    <div className="min-h-screen bg-page">
      <ConnectionsManager {...args} connections={mixedSet} />
    </div>
  ),
};

const dense: Connection[] = Array.from({ length: 18 }).map((_, i) => {
  const base = connectionsSeed[i % connectionsSeed.length]!;
  return {
    ...base,
    id: `${base.id}_x${i}`,
    name: `${base.name} · ${String.fromCharCode(65 + (i % 26))}${i.toString().padStart(2, "0")}`,
  };
});

/**
 * Dense — 18 rows. Stress-test for hover/focus bleed, layout shift on
 * tabular numerics, and the live-only pulse rule (no more 18 concurrent
 * red animations).
 */
export const Dense: Story = {
  render: (args) => (
    <div className="min-h-screen bg-page">
      <ConnectionsManager {...args} connections={dense} />
    </div>
  ),
};

/**
 * Grid view — same data as `Default`, defaulted to the card layout.
 */
export const GridView: Story = {
  render: (args) => (
    <div className="min-h-screen bg-page">
      <ConnectionsManager
        {...args}
        connections={connectionsSeed}
        initialView="grid"
      />
    </div>
  ),
};
