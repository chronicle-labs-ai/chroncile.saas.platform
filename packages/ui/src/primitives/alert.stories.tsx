import type { Meta, StoryObj } from "@storybook/react";
import { Alert, AlertDescription, AlertTitle } from "./alert";

const meta: Meta<typeof Alert> = {
  title: "Primitives/Alert",
  component: Alert,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof Alert>;

export const Default: Story = {
  render: () => (
    <Alert>
      <AlertTitle>Heads up</AlertTitle>
      <AlertDescription>
        Verify your email to publish workspaces and invite teammates.
      </AlertDescription>
    </Alert>
  ),
};

export const Destructive: Story = {
  render: () => (
    <Alert variant="destructive">
      <AlertTitle>Sync failed</AlertTitle>
      <AlertDescription>
        Doppler returned 401 — re-authenticate the integration and retry.
      </AlertDescription>
    </Alert>
  ),
};

export const Tones: Story = {
  render: () => (
    <div className="flex flex-col gap-s-3 max-w-[640px]">
      <Alert variant="info">
        <AlertTitle>Info</AlertTitle>
        <AlertDescription>
          A new release is rolling out across your environments.
        </AlertDescription>
      </Alert>
      <Alert variant="success">
        <AlertTitle>Success</AlertTitle>
        <AlertDescription>Backtest completed without regressions.</AlertDescription>
      </Alert>
      <Alert variant="warning">
        <AlertTitle>Warning</AlertTitle>
        <AlertDescription>
          Backfill is consuming above-baseline API quota.
        </AlertDescription>
      </Alert>
      <Alert variant="danger">
        <AlertTitle>Danger</AlertTitle>
        <AlertDescription>
          Production endpoint returned 5xx for the last 5 minutes.
        </AlertDescription>
      </Alert>
    </div>
  ),
};
