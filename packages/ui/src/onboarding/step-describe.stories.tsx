import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { StepDescribe, type DescribeState } from "./step-describe";
import { OnboardingShell } from "./onboarding-shell";

const Frame = ({ children }: { children: React.ReactNode }) => (
  <OnboardingShell currentStep="describe">{children}</OnboardingShell>
);

const meta: Meta<typeof StepDescribe> = {
  title: "Onboarding/StepDescribe",
  component: StepDescribe,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof StepDescribe>;

export const Freeform: Story = {
  render: () => {
    const [v, setV] = React.useState<DescribeState>({ mode: "freeform" });
    return (
      <Frame>
        <StepDescribe
          value={v}
          onChange={setV}
          onNext={() => alert("next " + JSON.stringify(v.intendedSources))}
        />
      </Frame>
    );
  },
};

export const FreeformPrefilled: Story = {
  render: () => {
    const [v, setV] = React.useState<DescribeState>({
      mode: "freeform",
      prompt:
        "A support agent for our Shopify store that triages Intercom conversations and issues Stripe refunds.",
    });
    return (
      <Frame>
        <StepDescribe value={v} onChange={setV} disableAnimation />
      </Frame>
    );
  },
};

export const Structured: Story = {
  render: () => {
    const [v, setV] = React.useState<DescribeState>({
      mode: "structured",
      name: "support-concierge",
      goal: "Resolve refunds in under 3 turns.",
      trigger: "New Intercom conversation",
    });
    return (
      <Frame>
        <StepDescribe value={v} onChange={setV} />
      </Frame>
    );
  },
};

export const Template: Story = {
  render: () => {
    const [v, setV] = React.useState<DescribeState>({ mode: "template" });
    return (
      <Frame>
        <StepDescribe value={v} onChange={setV} disableAnimation />
      </Frame>
    );
  },
};
