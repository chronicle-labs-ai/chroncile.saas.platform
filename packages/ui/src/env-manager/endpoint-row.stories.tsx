import type { Meta, StoryObj } from "@storybook/react";

import { EndpointRow } from "./endpoint-row";

const meta = {
  title: "Env Manager/EndpointRow",
  component: EndpointRow,
  parameters: { layout: "padded" },
  argTypes: {
    label: { control: "text" },
    value: { control: "text" },
    pendingLabel: { control: "text" },
    externalHref: { control: "text" },
    copyLabel: { control: "text" },
  },
  args: {
    label: "Backend",
    value: "https://chronicle-pr-1276.fly.dev",
    pendingLabel: "pending",
    copyLabel: "Copy",
  },
} satisfies Meta<typeof EndpointRow>;

export default meta;
type Story = StoryObj<typeof EndpointRow>;

function EndpointDemo() {
  return (
    <div className="max-w-[760px] overflow-hidden rounded-md border border-hairline bg-surface-01">
      <EndpointRow label="Backend" value="https://chronicle-pr-1276.fly.dev" />
      <EndpointRow
        label="Frontend"
        value="https://chronicle-pr-1276.vercel.app"
      />
      <EndpointRow label="Database" pendingLabel="private" />
    </div>
  );
}

export const Default: Story = {
  render: (args) => (
    <div className="max-w-[760px] overflow-hidden rounded-md border border-hairline bg-surface-01">
      <EndpointRow {...args} />
    </div>
  ),
};

export const EndpointList: Story = {
  render: () => <EndpointDemo />,
};
