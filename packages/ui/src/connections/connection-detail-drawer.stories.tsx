import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

import { Button } from "../primitives/button";
import { ConnectionDetailDrawer } from "./connection-detail-drawer";
import { type ConnectionDetailTab } from "./connection-detail-body";
import {
  connectionBackfillsSeed,
  connectionDeliveriesSeed,
  connectionEventSubsSeed,
  connectionsSeed,
  type Connection,
} from "./data";

const meta: Meta<typeof ConnectionDetailDrawer> = {
  title: "Connections/ConnectionDetailDrawer",
  component: ConnectionDetailDrawer,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof ConnectionDetailDrawer>;

function DrawerDemo({
  initial,
  initialTab = "overview",
}: {
  initial: Connection;
  initialTab?: ConnectionDetailTab;
}) {
  const [open, setOpen] = React.useState(true);
  const [tab, setTab] = React.useState<ConnectionDetailTab>(initialTab);
  const [conn, setConn] = React.useState<Connection>(initial);
  const [events, setEvents] = React.useState(
    () => connectionEventSubsSeed[conn.id] ?? [],
  );

  const toggleScope = (id: string, next: boolean) => {
    setConn((prev) => ({
      ...prev,
      scopes: next
        ? Array.from(new Set([...prev.scopes, id]))
        : prev.scopes.filter((s) => s !== id),
    }));
  };

  const toggleEvent = (id: string, next: boolean) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, enabled: next } : e)),
    );
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <Button onPress={() => setOpen(true)}>Reopen drawer</Button>
      <ConnectionDetailDrawer
        isOpen={open}
        onClose={() => setOpen(false)}
        connection={conn}
        tab={tab}
        onTabChange={setTab}
        backfills={connectionBackfillsSeed[conn.id] ?? []}
        deliveries={connectionDeliveriesSeed[conn.id] ?? []}
        events={events}
        onToggleScope={toggleScope}
        onToggleEvent={toggleEvent}
        onPause={() => console.log("pause")}
        onResume={() => console.log("resume")}
        onReauth={() => console.log("reauth")}
        onTest={() => console.log("test")}
        onDisconnect={() => console.log("disconnect")}
        onRotateSecret={() => console.log("rotate")}
        onRunBackfill={() => console.log("backfill")}
      />
    </div>
  );
}

const live = connectionsSeed.find((c) => c.id === "conn_intercom_01")!;
const stripe = connectionsSeed.find((c) => c.id === "conn_stripe_01")!;
const expired = connectionsSeed.find((c) => c.id === "conn_hubspot_01")!;
const errored = connectionsSeed.find((c) => c.id === "conn_zendesk_01")!;
const paused = connectionsSeed.find((c) => c.id === "conn_slack_01")!;

export const Overview: Story = {
  render: () => <DrawerDemo initial={live} />,
};

export const StripeEvents: Story = {
  render: () => <DrawerDemo initial={stripe} initialTab="events" />,
};

export const Expired: Story = {
  render: () => <DrawerDemo initial={expired} />,
};

export const Errored: Story = {
  render: () => <DrawerDemo initial={errored} initialTab="activity" />,
};

export const Paused: Story = {
  render: () => <DrawerDemo initial={paused} />,
};
