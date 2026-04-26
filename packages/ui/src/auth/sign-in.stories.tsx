import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { SignIn, type SignInValue } from "./sign-in";
import { AuthShell } from "./auth-shell";

const meta: Meta<typeof SignIn> = {
  title: "Auth/SignIn",
  component: SignIn,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof SignIn>;

const Frame = ({ children }: { children: React.ReactNode }) => (
  <AuthShell
    topbar={{
      cta: (
        <a
          href="#"
          className="text-ink-lo hover:text-ink-hi transition-colors"
          onClick={(e) => e.preventDefault()}
        >
          Create account →
        </a>
      ),
    }}
  >
    {children}
  </AuthShell>
);

/* ── C.1 — full SSO row + credentials (default sign-in) ─────── */

export const C1Default: Story = {
  name: "C.1 · full SSO row",
  render: () => {
    const [v, setV] = React.useState<SignInValue>({
      email: "",
      password: "",
    });
    return (
      <Frame>
        <SignIn
          value={v}
          onChange={setV}
          onSubmit={(val) => alert("submit " + val.email)}
          onForgot={() => alert("forgot")}
          onSignUp={() => alert("sign up")}
          onSSO={(p) => alert("SSO " + p)}
        />
      </Frame>
    );
  },
};

/* ── D.1 — typed email, no SSO match (normal credentials) ───── */

export const D1NoMatch: Story = {
  name: "D.1 · no SSO match (credentials)",
  render: () => (
    <Frame>
      <SignIn
        defaultValue={{ email: "ada@stripe.com", password: "" }}
        discover={{ kind: "free" }}
      />
    </Frame>
  ),
};

/* ── D.2 — SSO required (password hidden) ──────────────────── */

export const D2SSORequired: Story = {
  name: "D.2 · SSO required (password hidden)",
  render: () => (
    <Frame>
      <SignIn
        defaultValue={{ email: "alex@acme.com", password: "" }}
        discover={{
          kind: "sso_required",
          orgName: "Acme Industries",
          ssoProvider: "Okta",
        }}
        onSSO={(p) => alert("SSO " + p)}
      />
    </Frame>
  ),
};

export const WithError: Story = {
  render: () => (
    <Frame>
      <SignIn
        defaultValue={{ email: "ada@stripe.com", password: "wrong" }}
        error="Those credentials didn't match. Check the password and try again."
      />
    </Frame>
  ),
};

export const Submitting: Story = {
  render: () => (
    <Frame>
      <SignIn
        defaultValue={{ email: "ada@stripe.com", password: "right!" }}
        isSubmitting
      />
    </Frame>
  ),
};

export const SSOLoading: Story = {
  render: () => (
    <Frame>
      <SignIn ssoLoading="google" />
    </Frame>
  ),
};

export const HideSSO: Story = {
  render: () => (
    <Frame>
      <SignIn hideSSO />
    </Frame>
  ),
};
