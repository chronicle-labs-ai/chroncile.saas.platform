import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { StateError } from "./state-error";
import { Button } from "../primitives/button";
import { getSource } from "../onboarding/data";

const meta: Meta<typeof StateError> = {
  title: "Connectors/StateError",
  component: StateError,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof StateError>;

const SAMPLE_PAYLOAD = `{
  "error": "invalid_signature",
  "received": "v1=8c7e…",
  "expected": "v1=ba2f…",
  "ts": 1714250000
}`;

function SignatureDemo() {
  const [open, setOpen] = React.useState(true);
  return (
    <>
      <div className="p-s-6">
        <Button onPress={() => setOpen(true)}>Open error modal</Button>
      </div>
      <StateError
        isOpen={open}
        onClose={() => setOpen(false)}
        source={getSource("stripe")!}
        kind="signature"
        lastSeen="2 minutes ago"
        payload={SAMPLE_PAYLOAD}
        onRetry={() => setOpen(false)}
      />
    </>
  );
}

function AuthDemo() {
  const [open, setOpen] = React.useState(true);
  return (
    <StateError
      isOpen={open}
      onClose={() => setOpen(false)}
      source={getSource("intercom")!}
      kind="auth"
      lastSeen="just now"
      onRetry={() => setOpen(false)}
    />
  );
}

function RateLimitDemo() {
  const [open, setOpen] = React.useState(true);
  return (
    <StateError
      isOpen={open}
      onClose={() => setOpen(false)}
      source={getSource("hubspot")!}
      kind="rate-limit"
      lastSeen="< 1 min"
    />
  );
}

export const Signature: Story = { render: () => <SignatureDemo /> };
export const Auth: Story = { render: () => <AuthDemo /> };
export const RateLimit: Story = { render: () => <RateLimitDemo /> };
