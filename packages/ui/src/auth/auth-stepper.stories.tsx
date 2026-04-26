import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { AuthStepper } from "./auth-stepper";

const SIGNUP_STEPS = [
  { id: "email", label: "Account" },
  { id: "password", label: "Password" },
  { id: "verify", label: "Verify" },
  { id: "success", label: "Launch" },
];

const meta: Meta<typeof AuthStepper> = {
  title: "Auth/AuthStepper",
  component: AuthStepper,
  parameters: { layout: "centered" },
  args: { steps: SIGNUP_STEPS, currentIndex: 1 },
};
export default meta;
type Story = StoryObj<typeof AuthStepper>;

export const Default: Story = {};

export const FirstStep: Story = { args: { currentIndex: 0 } };
export const Mid: Story = { args: { currentIndex: 2 } };
export const Done: Story = { args: { currentIndex: 3 } };

export const Interactive: Story = {
  render: (args) => {
    const [i, setI] = React.useState(args.currentIndex);
    return (
      <div className="flex flex-col items-center gap-s-3">
        <AuthStepper {...args} currentIndex={i} onJump={setI} />
        <span className="font-mono text-mono-sm text-ink-dim">
          step {i + 1} / {args.steps.length}
        </span>
      </div>
    );
  },
};
