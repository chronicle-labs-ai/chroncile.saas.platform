import type { Meta, StoryObj } from "@storybook/react";

import { StreamEventDetail } from "./stream-event-detail";
import { streamTimelineSeed } from "./data";

const meta: Meta<typeof StreamEventDetail> = {
  title: "Stream Timeline/EventDetail",
  component: StreamEventDetail,
};
export default meta;
type Story = StoryObj<typeof StreamEventDetail>;

const intercomEvent = streamTimelineSeed.find((e) => e.source === "intercom") ?? null;
const stripeEvent = streamTimelineSeed.find((e) => e.source === "stripe") ?? null;
const githubEvent = streamTimelineSeed.find((e) => e.source === "github") ?? null;

export const Empty: Story = {
  render: () => (
    <div className="max-w-md p-s-4">
      <StreamEventDetail event={null} />
    </div>
  ),
};

export const Intercom: Story = {
  render: () => (
    <div className="max-w-md p-s-4">
      <StreamEventDetail event={intercomEvent} defaultPayloadOpen />
    </div>
  ),
};

export const Stripe: Story = {
  render: () => (
    <div className="max-w-md p-s-4">
      <StreamEventDetail event={stripeEvent} />
    </div>
  ),
};

export const NoMessage: Story = {
  render: () => (
    <div className="max-w-md p-s-4">
      <StreamEventDetail
        event={
          githubEvent
            ? { ...githubEvent, message: undefined, actor: undefined }
            : null
        }
      />
    </div>
  ),
};

export const UnknownSource: Story = {
  render: () => (
    <div className="max-w-md p-s-4">
      <StreamEventDetail
        event={{
          id: "evt_unknown_001",
          source: "acme-internal",
          type: "widget.shipped",
          occurredAt: new Date().toISOString(),
          actor: "fulfilment-bot",
          message: "Shipped 3 widgets to customer #4129",
          payload: { sku: "WID-3", qty: 3, customer: 4129 },
        }}
      />
    </div>
  ),
};
