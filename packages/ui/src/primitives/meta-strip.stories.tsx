import type { Meta, StoryObj } from "@storybook/react";

import { MetaStrip } from "./meta-strip";

const meta = {
  title: "Primitives/MetaStrip",
  component: MetaStrip,
  parameters: { layout: "centered" },
  argTypes: {
    items: { control: "object" },
  },
} satisfies Meta<typeof MetaStrip>;

export default meta;
type Story = StoryObj<typeof MetaStrip>;

const items = [
  { label: "type", value: "EPHEMERAL" },
  { label: "branch", value: "feature/invite-flow" },
  { label: "sha", value: "8f3a91c" },
  { label: "ttl", value: "18h remaining" },
];

export const Default: Story = {
  args: { items },
};
