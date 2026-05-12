import type { Meta, StoryObj } from "@storybook/react";
import { Logo } from "../../primitives/logo";

const meta: Meta<typeof Logo> = {
  title: "Brand/Logo",
  component: Logo,
  parameters: { layout: "padded" },
  argTypes: {
    variant: {
      control: "radio",
      options: ["icon", "wordmark"],
    },
    theme: {
      control: "radio",
      options: ["auto", "dark", "light"],
    },
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
      <Logo {...args} className="h-[40px] w-auto" />
    </div>
  ),
};

export const LockupOnDark: Story = {
  parameters: { theme: "dark" },
  render: () => (
    <div className="flex flex-col items-center gap-s-6 rounded-md border border-hairline bg-black p-s-16">
      <Logo variant="icon" theme="dark" className="h-[120px] w-[120px]" />
      <Logo variant="wordmark" theme="dark" className="h-[32px] w-auto" />
    </div>
  ),
};

export const LockupOnLight: Story = {
  parameters: { theme: "light" },
  render: () => (
    <div className="flex flex-col items-center gap-s-6 rounded-md border border-hairline bg-bone p-s-16">
      <Logo variant="icon" theme="light" className="h-[120px] w-[120px]" />
      <Logo variant="wordmark" theme="light" className="h-[32px] w-auto" />
    </div>
  ),
};
