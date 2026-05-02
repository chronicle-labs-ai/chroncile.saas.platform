import type { Meta, StoryObj } from "@storybook/react";
import { Logo } from "./logo";

const meta: Meta<typeof Logo> = {
  title: "Primitives/Logo",
  component: Logo,
  parameters: { layout: "padded" },
  argTypes: {
    variant: { control: "radio", options: ["icon", "wordmark"] },
    theme: { control: "radio", options: ["auto", "dark", "light"] },
  },
  args: { variant: "icon", theme: "auto" },
};
export default meta;
type Story = StoryObj<typeof Logo>;

export const Icon: Story = {
  args: { variant: "icon" },
  render: (args) => (
    <div className="inline-flex rounded-md border border-hairline bg-surface-01 p-s-8">
      <Logo {...args} className="h-[96px] w-[96px]" />
    </div>
  ),
};

export const Wordmark: Story = {
  args: { variant: "wordmark" },
  render: (args) => (
    <div className="inline-flex rounded-md border border-hairline bg-surface-01 p-s-8">
      <Logo {...args} className="h-[32px] w-auto" />
    </div>
  ),
};

export const Sizes: Story = {
  name: "Icon sizes",
  render: () => (
    <div className="flex items-end gap-s-6 rounded-md border border-hairline bg-surface-01 p-s-8">
      <Logo variant="icon" className="h-[24px] w-[24px]" />
      <Logo variant="icon" className="h-[48px] w-[48px]" />
      <Logo variant="icon" className="h-[96px] w-[96px]" />
      <Logo variant="icon" className="h-[160px] w-[160px]" />
    </div>
  ),
};

export const Lockup: Story = {
  name: "Icon + wordmark lockup",
  render: () => (
    <div className="flex flex-col items-start gap-s-6 rounded-md border border-hairline bg-surface-01 p-s-10">
      <Logo variant="icon" className="h-[64px] w-[64px]" />
      <Logo variant="wordmark" className="h-[24px] w-auto" />
    </div>
  ),
};
