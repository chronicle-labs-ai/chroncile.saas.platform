import type { Meta, StoryObj } from "@storybook/react";
import { StepStream } from "./step-stream";
import { OnboardingShell } from "./onboarding-shell";
import { LIGHT_PARAMS, MOBILE_PARAMS } from "./_story-helpers";

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
        onBack={() => alert("back")}
      />
    </Frame>
  ),
};

export const NoSourcesConnected: Story = {
  render: () => (
    <Frame>
      <StepStream value={{ connected: [] }} onBack={() => alert("back")} />
    </Frame>
  ),
};

/*
 * Lights up the typical sandbox flow — three sample sources
 * streaming live so reviewers can sanity-check the row density and
 * stagger of `cg-slide-in` animations.
 */
export const WithSandbox: Story = {
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

export const Mobile: Story = {
  parameters: { layout: "fullscreen", ...MOBILE_PARAMS },
  render: () => (
    <Frame>
      <StepStream
        value={{ connected: ["intercom", "shopify"] }}
        livePreview={false}
        onBack={() => alert("back")}
      />
    </Frame>
  ),
};

export const LightTheme: Story = {
  parameters: { layout: "fullscreen", ...LIGHT_PARAMS },
  render: () => (
    <Frame>
      <StepStream
        value={{ connected: ["intercom", "shopify", "stripe"] }}
        livePreview={false}
        onBack={() => alert("back")}
      />
    </Frame>
  ),
};
