import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { AcceptInvite } from "./accept-invite";
import { AuthShell } from "./auth-shell";

/*
 * Chrome (brand vs product) is driven by the global `data-chrome`
 * toolbar in `.storybook/preview.tsx`. `AuthShell` inherits from
 * that toolbar via `useChromeStyleContext`, so individual stories
 * don't need to plumb a `chromeStyle` prop.
 */

const meta: Meta<typeof AcceptInvite> = {
  title: "Auth/AcceptInvite",
  component: AcceptInvite,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof AcceptInvite>;

export const B2NewUser: Story = {
  name: "B.2 · sign-up path (new user)",
  args: {
    mode: "signup",
    email: "alex@acme.com",
    orgName: "Acme Industries",
    inviterName: "Marisol Vega",
    inviterAvatarSeed: "marisol",
  },
  render: (args) => (
    <AuthShell topbar={false}>
      <AcceptInvite
        {...args}
        onSubmit={(v) => alert("submit " + JSON.stringify(v))}
        onCancel={() => alert("cancel")}
      />
    </AuthShell>
  ),
};

export const B3ExistingUser: Story = {
  name: "B.3 · sign-in path (existing user)",
  args: {
    mode: "signin",
    email: "alex@acme.com",
    firstName: "Alex",
    orgName: "Acme Industries",
    inviterName: "Marisol Vega",
    inviterAvatarSeed: "marisol",
  },
  render: (args) => (
    <AuthShell topbar={false}>
      <AcceptInvite
        {...args}
        onSubmit={(v) => alert("submit " + JSON.stringify(v))}
        onCancel={() => alert("cancel")}
      />
    </AuthShell>
  ),
};

export const WithError: Story = {
  args: {
    mode: "signin",
    email: "alex@acme.com",
    firstName: "Alex",
    orgName: "Acme Industries",
    error: "Wrong password — try again or use Forgot password.",
  },
  render: (args) => (
    <AuthShell topbar={false}>
      <AcceptInvite {...args} />
    </AuthShell>
  ),
};

export const Submitting: Story = {
  args: {
    mode: "signup",
    email: "alex@acme.com",
    orgName: "Acme Industries",
    inviterName: "Marisol Vega",
    isSubmitting: true,
  },
  render: (args) => (
    <AuthShell topbar={false}>
      <AcceptInvite {...args} />
    </AuthShell>
  ),
};
