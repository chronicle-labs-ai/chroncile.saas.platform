import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { SignUpVerify } from "./sign-up-verify";
import { AuthShell } from "./auth-shell";

const SIGNUP_STEPS = [
  { id: "email", label: "Email" },
  { id: "password", label: "Password" },
  { id: "verify", label: "Verify" },
  { id: "workspace", label: "Workspace" },
];

const Frame = ({ children }: { children: React.ReactNode }) => (
  <AuthShell topbar={{ steps: SIGNUP_STEPS, currentIndex: 2 }}>
    {children}
  </AuthShell>
);

const meta: Meta<typeof SignUpVerify> = {
  title: "Auth/SignUpVerify",
  component: SignUpVerify,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof SignUpVerify>;

/* The plan's A.3 spec: code-grid styling + cooldown + expiry. */
export const A3CodeGrid: Story = {
  name: "A.3 · code-grid + cooldown + expiry",
  render: () => {
    const [verifying, setVerifying] = React.useState(false);
    const [success, setSuccess] = React.useState(false);
    const [err, setErr] = React.useState<string | null>(null);
    const handleVerify = async (code: string) => {
      setVerifying(true);
      setErr(null);
      await new Promise((r) => setTimeout(r, 700));
      setVerifying(false);
      if (code === "000000") {
        setErr("That code didn't match. Try again.");
      } else {
        setSuccess(true);
      }
    };
    /* expires-at — 14:32 from now to mirror the prototype's deadline. */
    const expiresAt = React.useMemo(
      () => new Date(Date.now() + (14 * 60 + 32) * 1000),
      [],
    );
    return (
      <Frame>
        <SignUpVerify
          email="ada@stripe.com"
          onVerify={handleVerify}
          onResend={() => console.log("resend")}
          onBack={() => alert("back")}
          isVerifying={verifying}
          success={success}
          error={err}
          resendCooldown={28}
          expiresAt={expiresAt}
        />
      </Frame>
    );
  },
};

export const ErrorState: Story = {
  render: () => (
    <Frame>
      <SignUpVerify
        email="ada@stripe.com"
        error="That code didn't match. Try again."
      />
    </Frame>
  ),
};

export const Verifying: Story = {
  render: () => (
    <Frame>
      <SignUpVerify email="ada@stripe.com" isVerifying />
    </Frame>
  ),
};

export const Success: Story = {
  render: () => (
    <Frame>
      <SignUpVerify email="ada@stripe.com" success />
    </Frame>
  ),
};

export const ResendCooldown: Story = {
  render: () => (
    <Frame>
      <SignUpVerify email="ada@stripe.com" resendCooldown={28} />
    </Frame>
  ),
};

export const ExpiryOnly: Story = {
  name: "live lede countdown (no cooldown)",
  render: () => {
    const expiresAt = React.useMemo(
      () => new Date(Date.now() + (9 * 60 + 12) * 1000),
      [],
    );
    return (
      <Frame>
        <SignUpVerify email="ada@stripe.com" expiresAt={expiresAt} />
      </Frame>
    );
  },
};

export const Expired: Story = {
  name: "expired (lede flips to 'Code expired')",
  render: () => {
    const expiresAt = React.useMemo(
      () => new Date(Date.now() - 10 * 1000),
      [],
    );
    return (
      <Frame>
        <SignUpVerify email="ada@stripe.com" expiresAt={expiresAt} />
      </Frame>
    );
  },
};
