import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { EventStream, type EventStreamItem } from "./event-stream";

const items: EventStreamItem[] = [
  {
    id: "1",
    time: "14:04:41",
    lane: "teal",
    topic: "support.conversation",
    verb: "created",
    preview: '"My last order never arrived." — Sarah Chen',
    source: "intercom",
  },
  {
    id: "2",
    time: "14:06:02",
    lane: "amber",
    topic: "shopify.order",
    verb: "lookup",
    preview: '{ order_id: "8821", status: "delivered" }',
    source: "shopify",
  },
  {
    id: "3",
    time: "14:06:41",
    lane: "green",
    topic: "agent.response",
    verb: "generated",
    preview: '"Your order was delivered last Thursday."',
    source: "support-ai",
  },
  {
    id: "4",
    time: "14:09:41",
    lane: "orange",
    topic: "ops.alert",
    verb: "triggered",
    preview: "sentiment_drop detected · customer_health 0.82 → 0.31",
    source: "ops",
  },
  {
    id: "5",
    time: "14:10:02",
    lane: "pink",
    topic: "agent.tool.invoke → escalate",
    preview: "Handing off to human agent · reason: shipping_error",
    source: "support-ai",
  },
  {
    id: "6",
    time: "14:11:08",
    lane: "green",
    topic: "stripe.refund",
    verb: "created",
    preview: "re_3Nf8q2L · $84.00 · order_id=8821",
    source: "stripe",
  },
];

const meta: Meta<typeof EventStream> = {
  title: "Product/EventStream",
  component: EventStream,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof EventStream>;

export const Interactive: Story = {
  render: () => {
    const [sel, setSel] = React.useState("5");
    return (
      <div className="h-[560px] w-full bg-surface-00">
        <EventStream
          items={items}
          selectedId={sel}
          onSelect={setSel}
          daySeparator="Today · Feb 18 2026"
        />
      </div>
    );
  },
};
