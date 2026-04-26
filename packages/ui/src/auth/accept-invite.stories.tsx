import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { AcceptInvite } from "./accept-invite";
import { AuthShell } from "./auth-shell";

const meta: Meta<typeof AcceptInvite> = {
  title: "Auth/AcceptInvite",
  component: AcceptInvite,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof AcceptInvite>;

const Frame = ({ children }: { children: React.ReactNode }) => (
  <AuthShell topbar={false}>{children}</AuthShell>
);

export const B2NewUser: Story = {
  name: "B.2 · sign-up path (new user)",
  render: () => (
    <Frame>
      <AcceptInvite
        mode="signup"
        email="alex@acme.com"
        orgName="Acme Industries"
        inviterName="Marisol Vega"
        inviterAvatarSeed="marisol"
        onSubmit={(v) => alert("submit " + JSON.stringify(v))}
        onCancel={() => alert("cancel")}
      />
    </Frame>
  ),
};

export const B3ExistingUser: Story = {
  name: "B.3 · sign-in path (existing user)",
  render: () => (
    <Frame>
      <AcceptInvite
        mode="signin"
        email="alex@acme.com"
        firstName="Alex"
        orgName="Acme Industries"
        inviterName="Marisol Vega"
        inviterAvatarSeed="marisol"
        onSubmit={(v) => alert("submit " + JSON.stringify(v))}
        onCancel={() => alert("cancel")}
      />
    </Frame>
  ),
};

export const WithError: Story = {
  render: () => (
    <Frame>
      <AcceptInvite
        mode="signin"
        email="alex@acme.com"
        firstName="Alex"
        orgName="Acme Industries"
        error="Wrong password — try again or use Forgot password."
      />
    </Frame>
  ),
};

export const Submitting: Story = {
  render: () => (
    <Frame>
      <AcceptInvite
        mode="signup"
        email="alex@acme.com"
        orgName="Acme Industries"
        inviterName="Marisol Vega"
        isSubmitting
      />
    </Frame>
  ),
};
