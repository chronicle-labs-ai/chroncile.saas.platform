import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
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

const onPause = fn();
const onResume = fn();
const onReauth = fn();
const onTest = fn();
const onDisconnect = fn();
const onRotateSecret = fn();
const onRunBackfill = fn();
const onOpenActivityLog = fn();

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
    <div className="min-h-screen bg-page p-6">
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
        onPause={onPause}
        onResume={onResume}
        onReauth={onReauth}
        onTest={onTest}
        onDisconnect={onDisconnect}
        onRotateSecret={onRotateSecret}
        onRunBackfill={onRunBackfill}
        onOpenActivityLog={onOpenActivityLog}
      />
    </div>
  );
}

const live = connectionsSeed.find((c) => c.id === "conn_intercom_01")!;
const stripe = connectionsSeed.find((c) => c.id === "conn_stripe_01")!;
const expired = connectionsSeed.find((c) => c.id === "conn_hubspot_01")!;
const errored = connectionsSeed.find((c) => c.id === "conn_zendesk_01")!;
const paused = connectionsSeed.find((c) => c.id === "conn_slack_01")!;

/**
 * Overview — default tab on a healthy live connection. The action
 * strip surfaces Pause / Re-authorize / Test, with Disconnect pushed
 * to the right edge in `critical` styling.
 */
export const Overview: Story = {
  render: () => <DrawerDemo initial={live} />,
};

/**
 * Stripe events — the per-event-type subscription editor on a Stripe
 * connection. Now uses the shared `Chip` primitive so the pressed
 * state matches the toolbar's filter chips.
 */
export const StripeEvents: Story = {
  render: () => <DrawerDemo initial={stripe} initialTab="events" />,
};

/**
 * Expired — token has expired. Overview surfaces a warning
 * `InlineAlert` and the Re-authorize action becomes the primary CTA.
 */
export const Expired: Story = {
  render: () => <DrawerDemo initial={expired} />,
};

/**
 * Errored — Activity tab on a connection currently in `error`. The
 * header badge is loud red but no longer pulses (the row badge is
 * static signal, not animation).
 */
export const Errored: Story = {
  render: () => <DrawerDemo initial={errored} initialTab="activity" />,
};

/**
 * Paused — info-toned `InlineAlert` and the action strip swaps Pause
 * for Resume.
 */
export const Paused: Story = {
  render: () => <DrawerDemo initial={paused} />,
};
