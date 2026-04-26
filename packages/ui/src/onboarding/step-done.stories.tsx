import type { Meta, StoryObj } from "@storybook/react";
import { StepDone } from "./step-done";
import { OnboardingShell } from "./onboarding-shell";

const Frame = ({ children }: { children: React.ReactNode }) => (
  <OnboardingShell currentStep="done">{children}</OnboardingShell>
);

const meta: Meta<typeof StepDone> = {
  title: "Onboarding/StepDone",
  component: StepDone,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof StepDone>;

export const Default: Story = {
  render: () => (
    <Frame>
      <StepDone
        value={{
          name: "support-concierge",
          connected: ["intercom", "shopify", "stripe", "slack"],
        }}
        onOpen={() => alert("open workspace")}
        onRestart={() => alert("restart")}
      />
    </Frame>
  ),
};

export const NoSources: Story = {
  render: () => (
    <Frame>
      <StepDone value={{ connected: [] }} />
    </Frame>
  ),
};
