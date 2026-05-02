import type { Meta, StoryObj } from "@storybook/react";
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
      onPause={() => console.log("pause")}
      onResume={() => console.log("resume")}
      onReauth={() => console.log("reauth")}
      onTest={() => console.log("test")}
      onDisconnect={() => console.log("disconnect")}
      onRotateSecret={() => console.log("rotate")}
      onRunBackfill={() => console.log("backfill")}
      onBack={() => console.log("back")}
    />
  );
}

const live = connectionsSeed.find((c) => c.id === "conn_intercom_01")!;
const stripe = connectionsSeed.find((c) => c.id === "conn_stripe_01")!;
const errored = connectionsSeed.find((c) => c.id === "conn_zendesk_01")!;

export const Live: Story = { render: () => <PageDemo initial={live} /> };
export const StripeEvents: Story = {
  render: () => <PageDemo initial={stripe} initialTab="events" />,
};
export const Errored: Story = {
  render: () => <PageDemo initial={errored} initialTab="activity" />,
};
