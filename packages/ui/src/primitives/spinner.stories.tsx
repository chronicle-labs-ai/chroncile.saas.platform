import type { Meta, StoryObj } from "@storybook/react";
import { Spinner } from "./spinner";

const meta: Meta<typeof Spinner> = {
  title: "Primitives/Spinner",
  component: Spinner,
  parameters: { layout: "centered" },
};
export default meta;
type Story = StoryObj<typeof Spinner>;

export const Sizes: Story = {
  render: () => (
    <div className="flex items-end gap-s-4">
      <Spinner size="sm" />
      <Spinner size="md" />
      <Spinner size="lg" />
      <Spinner size="xl" />
    </div>
  ),
};

export const Tones: Story = {
  render: () => (
    <div className="flex items-center gap-s-4">
      <Spinner tone="default" />
      <Spinner tone="ember" />
      <Spinner tone="success" />
      <Spinner tone="danger" />
    </div>
  ),
};
