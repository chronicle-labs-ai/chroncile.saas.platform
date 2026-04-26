import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { ForgotPassword } from "./forgot-password";
import { AuthShell } from "./auth-shell";

const Frame = ({ children }: { children: React.ReactNode }) => (
  <AuthShell
    topbar={{
      cta: (
        <a
          href="#"
          className="text-ink-lo hover:text-ink-hi transition-colors"
          onClick={(e) => e.preventDefault()}
        >
          Sign in →
        </a>
      ),
    }}
  >
    {children}
  </AuthShell>
);

const meta: Meta<typeof ForgotPassword> = {
  title: "Auth/ForgotPassword",
  component: ForgotPassword,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof ForgotPassword>;

export const Empty: Story = {
  name: "empty",
  render: () => (
    <Frame>
      <ForgotPassword
        onSubmit={(e) => alert("send to " + e)}
        onBack={() => alert("back")}
      />
    </Frame>
  ),
};

export const Sent: Story = {
  name: "sent confirmation",
  render: () => (
    <Frame>
      <ForgotPassword sent value="ada@stripe.com" />
    </Frame>
  ),
};

export const WithError: Story = {
  name: "error",
  render: () => (
    <Frame>
      <ForgotPassword
        defaultValue="ada@"
        error="That email isn't on file."
      />
    </Frame>
  ),
};

export const Live: Story = {
  render: () => {
    const [v, setV] = React.useState("");
    const [sent, setSent] = React.useState(false);
    return (
      <Frame>
        <ForgotPassword
          value={v}
          onChange={setV}
          sent={sent}
          onSubmit={() => setSent(true)}
          onBack={() => setSent(false)}
        />
      </Frame>
    );
  },
};
