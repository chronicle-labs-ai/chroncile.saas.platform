import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import * as React from "react";

import { ConnectionDetailPage } from "./connection-detail-page";
import { type ConnectionDetailTab } from "./connection-detail-body";
import {
  connectionBackfillsSeed,
  connectionDeliveriesSeed,
  connectionEventSubsSeed,
  connectionsSeed,
  type Connection,
} from "./data";

const meta: Meta<typeof ConnectionDetailPage> = {
  title: "Connections/ConnectionDetailPage",
  component: ConnectionDetailPage,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof ConnectionDetailPage>;

const onPause = fn();
const onResume = fn();
const onReauth = fn();
const onTest = fn();
const onDisconnect = fn();
const onRotateSecret = fn();
const onRunBackfill = fn();
const onBack = fn();
const onOpenActivityLog = fn();

function PageDemo({
  initial,
  initialTab = "overview",
}: {
  initial: Connection;
  initialTab?: ConnectionDetailTab;
}) {
  const [tab, setTab] = React.useState<ConnectionDetailTab>(initialTab);
  return (
    <ConnectionDetailPage
      connection={initial}
      tab={tab}
      onTabChange={setTab}
      backfills={connectionBackfillsSeed[initial.id] ?? []}
      deliveries={connectionDeliveriesSeed[initial.id] ?? []}
      events={connectionEventSubsSeed[initial.id] ?? []}
      onPause={onPause}
      onResume={onResume}
      onReauth={onReauth}
      onTest={onTest}
      onDisconnect={onDisconnect}
      onRotateSecret={onRotateSecret}
      onRunBackfill={onRunBackfill}
      onBack={onBack}
      onOpenActivityLog={onOpenActivityLog}
    />
  );
}

const live = connectionsSeed.find((c) => c.id === "conn_intercom_01")!;
const stripe = connectionsSeed.find((c) => c.id === "conn_stripe_01")!;
const errored = connectionsSeed.find((c) => c.id === "conn_zendesk_01")!;

/**
 * Live — full-page detail surface for a healthy connection. The
 * breadcrumb shows workspace → Connections → name in the ember accent;
 * the back affordance returns to the list.
 */
export const Live: Story = { render: () => <PageDemo initial={live} /> };

/**
 * Stripe events — per-event-type subscription editor on the
 * full-page surface. Same `Chip`-based UI as the drawer.
 */
export const StripeEvents: Story = {
  render: () => <PageDemo initial={stripe} initialTab="events" />,
};

/**
 * Errored — Activity tab on a connection currently in `error`. Use
 * this to verify the failure payload renders correctly inside the
 * page-width container.
 */
export const Errored: Story = {
  render: () => <PageDemo initial={errored} initialTab="activity" />,
};
