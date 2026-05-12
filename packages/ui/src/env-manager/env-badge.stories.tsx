import type { Meta, StoryObj } from "@storybook/react";

import { EnvBadge } from "./env-badge";

const meta = {
  title: "Env Manager/EnvBadge",
  component: EnvBadge,
  parameters: { layout: "centered" },
  argTypes: {
    variant: {
      control: "select",
      options: ["prod", "stg", "dev", "local", "ephemeral"],
    },
    children: { control: "text" },
  },
  args: { variant: "ephemeral", children: "EPH" },
} satisfies Meta<typeof EnvBadge>;

export default meta;
type Story = StoryObj<typeof EnvBadge>;

function BadgeDemo() {
  return (
    <div className="flex flex-wrap gap-s-2">
      <EnvBadge variant="prod" />
      <EnvBadge variant="stg" />
      <EnvBadge variant="dev" />
      <EnvBadge variant="local" />
      <EnvBadge variant="ephemeral" />
    </div>
  );
}

export const Default: Story = {};

export const AllVariants: Story = {
  render: () => <BadgeDemo />,
};
