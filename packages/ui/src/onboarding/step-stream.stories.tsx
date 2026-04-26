import type { Meta, StoryObj } from "@storybook/react";
import { StepStream } from "./step-stream";
import { OnboardingShell } from "./onboarding-shell";

const Frame = ({ children }: { children: React.ReactNode }) => (
  <OnboardingShell currentStep="stream">{children}</OnboardingShell>
);

const meta: Meta<typeof StepStream> = {
  title: "Onboarding/StepStream",
  component: StepStream,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof StepStream>;

export const Default: Story = {
  render: () => (
    <Frame>
      <StepStream
        value={{ connected: ["intercom", "shopify", "stripe"] }}
        onNext={() => alert("next")}
        onBack={() => alert("back")}
      />
    </Frame>
  ),
};

export const Paused: Story = {
  render: () => (
    <Frame>
      <StepStream
        value={{ connected: ["intercom", "stripe"] }}
        livePreview={false}
      />
    </Frame>
  ),
};

export const NoSourcesConnected: Story = {
  render: () => (
    <Frame>
      <StepStream value={{ connected: [] }} />
    </Frame>
  ),
};
