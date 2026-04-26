import type { Meta, StoryObj } from "@storybook/react";
import { SSOButton } from "./sso-button";

const meta: Meta<typeof SSOButton> = {
  title: "Primitives/SSOButton",
  component: SSOButton,
  parameters: { layout: "centered" },
  argTypes: {
    provider: {
      control: "radio",
      options: ["google", "github", "passkey", "custom"],
    },
    isLoading: { control: "boolean" },
    isDisabled: { control: "boolean" },
  },
  args: { provider: "google" },
};
export default meta;
type Story = StoryObj<typeof SSOButton>;

export const Default: Story = {
  render: (args) => (
    <div className="w-[360px]">
      <SSOButton {...args} />
    </div>
  ),
};

export const Stack: Story = {
  render: () => (
    <div className="flex w-[360px] flex-col gap-s-2">
      <SSOButton provider="google" kbd="G" />
      <SSOButton provider="github" kbd="H" />
      <SSOButton provider="passkey" kbd="P" />
    </div>
  ),
};

export const Loading: Story = {
  args: { isLoading: true },
  render: (args) => (
    <div className="w-[360px]">
      <SSOButton {...args} />
    </div>
  ),
};

export const Disabled: Story = {
  args: { isDisabled: true },
  render: (args) => (
    <div className="w-[360px]">
      <SSOButton {...args} />
    </div>
  ),
};

export const Custom: Story = {
  render: () => (
    <div className="w-[360px]">
      <SSOButton
        provider="custom"
        icon={
          <svg
            width="18"
            height="18"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden
          >
            <rect
              x="2"
              y="2"
              width="12"
              height="12"
              rx="2"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M5 8l2 2 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        }
      >
        Continue with Okta
      </SSOButton>
    </div>
  ),
};
