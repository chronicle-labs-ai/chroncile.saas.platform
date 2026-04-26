import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { SSORedirect } from "./sso-redirect";
import { AuthShell } from "./auth-shell";

const meta: Meta<typeof SSORedirect> = {
  title: "Auth/SSORedirect",
  component: SSORedirect,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof SSORedirect>;

const Frame = ({ children }: { children: React.ReactNode }) => (
  <AuthShell topbar={false} maxWidth={720}>
    {children}
  </AuthShell>
);

export const C2Google: Story = {
  name: "C.2 · Google (no org pre-bound)",
  render: () => (
    <Frame>
      <SSORedirect
        provider="Google"
        authorizationUrl="https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=client_01H8YV…&redirect_uri=https%3A%2F%2Fchronicle.io%2Fapi%2Fauth%2Fcallback&state=st_01H8…&scope=openid+profile+email"
        state="st_01H8YV4Q3X2C9R3KJ8K3M3VG2D"
        redirectUri="https://chronicle.io/api/auth/callback"
        scope="openid profile email"
      />
    </Frame>
  ),
};

export const D3OktaPreBound: Story = {
  name: "D.3 · Okta (org pre-bound)",
  render: () => (
    <Frame>
      <SSORedirect
        provider="Okta"
        authorizationUrl="https://acme.okta.com/oauth2/v1/authorize?response_type=code&client_id=client_01H8YV…&redirect_uri=https%3A%2F%2Fchronicle.io%2Fapi%2Fauth%2Fcallback&state=st_01H8…&scope=openid+profile+email&organization_id=org_01H8YV4Q3X2C9R3KJ8K3M3VG2D"
        state="st_01H8YV4Q3X2C9R3KJ8K3M3VG2D"
        redirectUri="https://chronicle.io/api/auth/callback"
        scope="openid profile email"
        organizationId="org_01H8YV4Q3X2C9R3KJ8K3M3VG2D"
      />
    </Frame>
  ),
};
