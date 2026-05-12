import type { Meta, StoryObj } from "@storybook/react";

import { BackLink } from "./back-link";

const meta = {
  title: "Primitives/BackLink",
  component: BackLink,
  parameters: { layout: "centered" },
  argTypes: {
    href: { control: "text" },
    children: { control: "text" },
  },
} satisfies Meta<typeof BackLink>;

export default meta;
type Story = StoryObj<typeof BackLink>;

export const Default: Story = {
  args: {
    href: "#",
    children: "Back to environments",
  },
};
