import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { StepBilling, type BillingState } from "./step-billing";
import { OnboardingShell } from "./onboarding-shell";

const Frame = ({ children }: { children: React.ReactNode }) => (
  <OnboardingShell currentStep="billing">{children}</OnboardingShell>
);

const meta: Meta<typeof StepBilling> = {
  title: "Onboarding/StepBilling",
  component: StepBilling,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof StepBilling>;

const SEED: BillingState = {
  plan: "team",
  card: { num: "", exp: "", cvc: "", name: "" },
  billingEmail: "",
};

export const Default: Story = {
  render: () => {
    const [v, setV] = React.useState<BillingState>(SEED);
    return (
      <Frame>
        <StepBilling
          value={v}
          onChange={setV}
          onNext={() => alert("next " + v.plan)}
          onBack={() => alert("back")}
        />
      </Frame>
    );
  },
};

export const Sandbox: Story = {
  render: () => {
    const [v, setV] = React.useState<BillingState>({
      ...SEED,
      plan: "free",
      sandbox: true,
    });
    return (
      <Frame>
        <StepBilling value={v} onChange={setV} />
      </Frame>
    );
  },
};

export const Scale: Story = {
  render: () => {
    const [v, setV] = React.useState<BillingState>({
      ...SEED,
      plan: "scale",
    });
    return (
      <Frame>
        <StepBilling value={v} onChange={setV} />
      </Frame>
    );
  },
};
