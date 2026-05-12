import type { Meta, StoryObj } from "@storybook/react";
import { EventRow } from "./event-row";

const meta: Meta<typeof EventRow> = {
  title: "Product/EventRow",
  component: EventRow,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof EventRow>;

export const List: Story = {
  render: () => (
    <div className="w-[720px] rounded-md border border-hairline bg-surface-00">
      <EventRow
        time="14:04:41"
        lane="teal"
        topic="support.conversation"
        verb="created"
        preview='"My last order never arrived. It&apos;s been almost two weeks."'
        source="intercom"
      />
      <EventRow
        time="14:06:02"
        lane="amber"
        topic="shopify.order"
        verb="lookup"
        preview='{ order_id: "8821", status: "delivered" }'
        source="shopify"
      />
      <EventRow
        time="14:10:02"
        lane="pink"
        topic="agent.tool.invoke → escalate"
        preview="Handing off to human agent · reason: shipping_error · tier: priority"
        source="support-ai"
        selected
      />
      <EventRow
        time="14:11:08"
        lane="green"
        topic="stripe.refund"
        verb="created"
        preview="re_3Nf8q2L · $84.00 · order_id=8821"
        source="stripe"
      />
    </div>
  ),
};
