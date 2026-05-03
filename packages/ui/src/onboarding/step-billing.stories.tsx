import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { StepBilling, type BillingState } from "./step-billing";
import { OnboardingShell } from "./onboarding-shell";
import { LIGHT_PARAMS, MOBILE_PARAMS } from "./_story-helpers";

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

/*
 * Pre-fills the Stripe test card so reviewers can see the brand
 * glyph swap, the formatted card number with proper grouping, and
 * the enabled Continue button without typing.
 */
export const TeamFilled: Story = {
  render: () => {
    const [v, setV] = React.useState<BillingState>({
      ...SEED,
      plan: "team",
      card: {
        num: "4242 4242 4242 4242",
        exp: "12/29",
        cvc: "242",
        name: "Ada Lovelace",
      },
      billingEmail: "billing@chronicle.app",
    });
    return (
      <Frame>
        <StepBilling
          value={v}
          onChange={setV}
          onNext={() => alert("confirm " + v.plan)}
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

export const Mobile: Story = {
  parameters: { layout: "fullscreen", ...MOBILE_PARAMS },
  render: () => {
    const [v, setV] = React.useState<BillingState>(SEED);
    return (
      <Frame>
        <StepBilling value={v} onChange={setV} />
      </Frame>
    );
  },
};

export const LightTheme: Story = {
  parameters: { layout: "fullscreen", ...LIGHT_PARAMS },
  render: () => {
    const [v, setV] = React.useState<BillingState>(SEED);
    return (
      <Frame>
        <StepBilling value={v} onChange={setV} />
      </Frame>
    );
  },
};
