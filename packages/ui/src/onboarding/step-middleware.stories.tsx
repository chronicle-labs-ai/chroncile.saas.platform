import type { Meta, StoryObj } from "@storybook/react";
import { StepMiddleware } from "./step-middleware";
import { OnboardingShell } from "./onboarding-shell";

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
