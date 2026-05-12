import type { Meta, StoryObj } from "@storybook/react";
import { StepDone } from "./step-done";
import { OnboardingShell } from "./onboarding-shell";
import { LIGHT_PARAMS, MOBILE_PARAMS } from "./_story-helpers";

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

/*
 * Stress-tests the headline wrap on the `clamp(40px, 6vw, 64px)`
 * display scale — long agent names should reflow rather than
 * overflow the column.
 */
export const LongName: Story = {
  render: () => (
    <Frame>
      <StepDone
        value={{
          name: "very-long-customer-support-concierge-agent-name",
          connected: ["intercom", "shopify", "stripe", "slack", "hubspot"],
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
      <StepDone
        value={{ connected: [] }}
        onOpen={() => alert("open workspace")}
        onRestart={() => alert("restart")}
      />
    </Frame>
  ),
};

export const Mobile: Story = {
  parameters: { layout: "fullscreen", ...MOBILE_PARAMS },
  render: () => (
    <Frame>
      <StepDone
        value={{
          name: "support-concierge",
          connected: ["intercom", "shopify", "stripe"],
        }}
        onOpen={() => alert("open workspace")}
        onRestart={() => alert("restart")}
      />
    </Frame>
  ),
};

export const LightTheme: Story = {
  parameters: { layout: "fullscreen", ...LIGHT_PARAMS },
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
