import type { Meta, StoryObj } from "@storybook/react";
import { OrDivider } from "./or-divider";

const meta: Meta<typeof OrDivider> = {
  title: "Primitives/OrDivider",
  component: OrDivider,
  parameters: { layout: "padded" },
  args: {},
};
export default meta;
type Story = StoryObj<typeof OrDivider>;

export const Default: Story = {
  render: (args) => (
    <div className="w-[420px]">
      <OrDivider {...args} />
    </div>
  ),
};

export const SignupLabel: Story = {
  render: () => (
    <div className="w-[420px]">
      <OrDivider label="or sign up with email" />
    </div>
  ),
};

export const Bare: Story = {
  render: () => (
    <div className="w-[420px]">
      <OrDivider label={null} />
    </div>
  ),
};
