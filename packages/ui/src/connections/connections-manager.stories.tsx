import type { Meta, StoryObj } from "@storybook/react";

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
};
export default meta;
type Story = StoryObj<typeof ConnectionsManager>;

export const Default: Story = {
  render: () => (
    <div className="min-h-screen bg-background">
      <ConnectionsManager
        connections={connectionsSeed}
        backfillsByConnection={connectionBackfillsSeed}
        deliveriesByConnection={connectionDeliveriesSeed}
        eventSubsByConnection={connectionEventSubsSeed}
      />
    </div>
  ),
};

export const Empty: Story = {
  render: () => (
    <div className="min-h-screen bg-background">
      <ConnectionsManager connections={[]} />
    </div>
  ),
};

const mixedSet: Connection[] = [
  connectionsSeed.find((c) => c.id === "conn_intercom_01")!,
  connectionsSeed.find((c) => c.id === "conn_slack_01")!,
  connectionsSeed.find((c) => c.id === "conn_hubspot_01")!,
  connectionsSeed.find((c) => c.id === "conn_zendesk_01")!,
];

export const Mixed: Story = {
  render: () => (
    <div className="min-h-screen bg-background">
      <ConnectionsManager
        connections={mixedSet}
        backfillsByConnection={connectionBackfillsSeed}
        deliveriesByConnection={connectionDeliveriesSeed}
        eventSubsByConnection={connectionEventSubsSeed}
      />
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

export const Dense: Story = {
  render: () => (
    <div className="min-h-screen bg-background">
      <ConnectionsManager connections={dense} />
    </div>
  ),
};

export const GridView: Story = {
  render: () => (
    <div className="min-h-screen bg-background">
      <ConnectionsManager
        connections={connectionsSeed}
        backfillsByConnection={connectionBackfillsSeed}
        deliveriesByConnection={connectionDeliveriesSeed}
        eventSubsByConnection={connectionEventSubsSeed}
        initialView="grid"
      />
    </div>
  ),
};
