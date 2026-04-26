import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { StepConnect, type ConnectState } from "./step-connect";
import { OnboardingShell } from "./onboarding-shell";

const Frame = ({ children }: { children: React.ReactNode }) => (
  <OnboardingShell currentStep="connect">{children}</OnboardingShell>
);

const meta: Meta<typeof StepConnect> = {
  title: "Onboarding/StepConnect",
  component: StepConnect,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof StepConnect>;

export const Empty: Story = {
  render: () => {
    const [v, setV] = React.useState<ConnectState>({
      connected: [],
      backfills: {},
    });
    return (
      <Frame>
        <StepConnect
          value={v}
          onChange={setV}
          onNext={() => alert("next " + v.connected.join(","))}
        />
      </Frame>
    );
  },
};

export const WithDetected: Story = {
  render: () => {
    const [v, setV] = React.useState<ConnectState>({
      connected: [],
      backfills: {},
      intendedSources: ["intercom", "shopify", "stripe"],
    });
    return (
      <Frame>
        <StepConnect value={v} onChange={setV} />
      </Frame>
    );
  },
};

export const Sandbox: Story = {
  render: () => {
    const [v, setV] = React.useState<ConnectState>({
      connected: [],
      backfills: {},
      sandbox: true,
    });
    return (
      <Frame>
        <StepConnect value={v} onChange={setV} />
      </Frame>
    );
  },
};

export const ConnectedWithBackfills: Story = {
  render: () => {
    const [v, setV] = React.useState<ConnectState>({
      connected: ["intercom", "stripe"],
      backfills: {
        intercom: {
          status: "running",
          progress: 0.42,
          windowDays: 30,
          entities: ["conversations", "contacts"],
          estEvents: 6750,
        },
        stripe: {
          status: "done",
          progress: 1,
          windowDays: 90,
          entities: ["charges", "refunds"],
          estEvents: 25200,
        },
      },
      intendedSources: ["intercom", "stripe", "shopify"],
    });
    return (
      <Frame>
        <StepConnect value={v} onChange={setV} />
      </Frame>
    );
  },
};
