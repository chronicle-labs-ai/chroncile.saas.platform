import type { Meta, StoryObj } from "@storybook/react";
import { StepMiddleware } from "./step-middleware";
import { OnboardingShell } from "./onboarding-shell";
import { LIGHT_PARAMS, MOBILE_PARAMS } from "./_story-helpers";

const Frame = ({ children }: { children: React.ReactNode }) => (
  <OnboardingShell currentStep="middleware">{children}</OnboardingShell>
);

const meta: Meta<typeof StepMiddleware> = {
  title: "Onboarding/StepMiddleware",
  component: StepMiddleware,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof StepMiddleware>;

export const Default: Story = {
  render: () => (
    <Frame>
      <StepMiddleware
        onNext={() => alert("next")}
        onBack={() => alert("back")}
      />
    </Frame>
  ),
};

export const Node: Story = {
  render: () => (
    <Frame>
      <StepMiddleware defaultLanguage="node" />
    </Frame>
  ),
};

export const Curl: Story = {
  render: () => (
    <Frame>
      <StepMiddleware defaultLanguage="curl" />
    </Frame>
  ),
};

export const Waiting: Story = {
  render: () => (
    <Frame>
      <StepMiddleware waiting />
    </Frame>
  ),
};

export const Received: Story = {
  render: () => (
    <Frame>
      <StepMiddleware received />
    </Frame>
  ),
};

/*
 * Surfaces the new `error` prop — the alert glyph + red copy
 * replace the spinner / check while the Test button stays
 * actionable so the user can retry without leaving the row.
 */
export const TestFailed: Story = {
  render: () => (
    <Frame>
      <StepMiddleware
        error="Couldn't reach https://your-agent.com/hook — check the URL and retry."
      />
    </Frame>
  ),
};

export const Mobile: Story = {
  parameters: { layout: "fullscreen", ...MOBILE_PARAMS },
  render: () => (
    <Frame>
      <StepMiddleware defaultLanguage="node" />
    </Frame>
  ),
};

export const LightTheme: Story = {
  parameters: { layout: "fullscreen", ...LIGHT_PARAMS },
  render: () => (
    <Frame>
      <StepMiddleware received />
    </Frame>
  ),
};
