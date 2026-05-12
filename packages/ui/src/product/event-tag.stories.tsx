import type { Meta, StoryObj } from "@storybook/react";
import { EventTag } from "./event-tag";

const meta: Meta<typeof EventTag> = {
  title: "Product/EventTag",
  component: EventTag,
  parameters: { layout: "centered" },
};
export default meta;
type Story = StoryObj<typeof EventTag>;

export const AllRoles: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-s-3">
      <EventTag role="customer" />
      <EventTag role="agent" />
      <EventTag role="system" />
      <EventTag role="divergence" />
    </div>
  ),
};
