import type { Meta, StoryObj } from "@storybook/react";
import { AuthTopbar } from "./auth-topbar";

const meta: Meta<typeof AuthTopbar> = {
  title: "Auth/AuthTopbar",
  component: AuthTopbar,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof AuthTopbar>;

const SIGNUP_STEPS = [
  { id: "email", label: "Account" },
  { id: "password", label: "Password" },
  { id: "verify", label: "Verify" },
  { id: "success", label: "Launch" },
];

export const NoFlow: Story = {
  args: {
    cta: (
      <a href="#" className="text-ink-lo hover:text-ink-hi transition-colors">
        Create account →
      </a>
    ),
  },
};

export const SignUpFlow: Story = {
  args: { steps: SIGNUP_STEPS, currentIndex: 1 },
};

export const SignUpFlowDone: Story = {
  args: { steps: SIGNUP_STEPS, currentIndex: 3 },
};
