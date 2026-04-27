import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import {
  SignUpEmail,
  type SignUpEmailValue,
  type DiscoverResult,
} from "./sign-up-email";
import { AuthShell } from "./auth-shell";

const SIGNUP_STEPS = [
  { id: "email", label: "Email" },
  { id: "password", label: "Password" },
  { id: "verify", label: "Verify" },
  { id: "workspace", label: "Workspace" },
];

const Frame = ({ children }: { children: React.ReactNode }) => (
  <AuthShell topbar={{ steps: SIGNUP_STEPS, currentIndex: 0 }}>
    {children}
  </AuthShell>
);

const meta: Meta<typeof SignUpEmail> = {
  title: "Auth/SignUpEmail",
  component: SignUpEmail,
  parameters: { layout: "fullscreen" },
  argTypes: {
    persona: {
      control: "radio",
      options: ["signup", "founder", "sales", "engineer"],
    },
  },
  args: { persona: "signup" },
};
export default meta;
type Story = StoryObj<typeof SignUpEmail>;

/* ── A.1 — free domain (default happy path) ─────────────────── */

export const A1Free: Story = {
  name: "A.1 · free (no existing workspace)",
  render: (args) => {
    const [v, setV] = React.useState<SignUpEmailValue>({
      email: "ada@stripe.com",
    });
    const discover: DiscoverResult = { kind: "free" };
    return (
      <Frame>
        <SignUpEmail
          {...args}
          value={v}
          onChange={setV}
          discover={discover}
          onSubmit={(val) => alert("continue " + val.email)}
          onSignIn={() => alert("sign in")}
          onSSO={(p) => alert("SSO " + p)}
        />
      </Frame>
    );
  },
};

/* ── A.1c — collision (existing workspace) ──────────────────── */

export const A1cExisting: Story = {
  name: "A.1c · collision (workspace exists)",
  render: (args) => (
    <Frame>
      <SignUpEmail
        {...args}
        defaultValue={{ email: "alex@acme.com" }}
        discover={{ kind: "existing", orgName: "Acme Industries" }}
        onSignIn={() => alert("sign in")}
      />
    </Frame>
  ),
};

/* ── A.1p — pending invite ─────────────────────────────────── */

export const A1pPendingInvite: Story = {
  name: "A.1p · pending invite",
  render: (args) => (
    <Frame>
      <SignUpEmail
        {...args}
        defaultValue={{ email: "alex@acme.com" }}
        discover={{
          kind: "pending_invite",
          orgName: "Acme Industries",
          inviteId: "inv_01H8YV4Q3X2C",
        }}
        onResendInvite={(id) => alert("resend " + id)}
        onSignIn={() => alert("sign in (bottom bar)")}
        onSignInInstead={() =>
          alert("sign in instead (existing-workspace alert)")
        }
        onSignInPending={() =>
          alert("sign in instead (pending-invite alert) — distinct destination")
        }
      />
    </Frame>
  ),
};

/* ── A.1s — SSO required ────────────────────────────────────── */

export const A1sSSORequired: Story = {
  name: "A.1s · SSO required",
  render: (args) => (
    <Frame>
      <SignUpEmail
        {...args}
        defaultValue={{ email: "alex@acme.com" }}
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

/* ── Live debounce demo wiring all four sub-states ─────────── */

export const Live: Story = {
  name: "live (debounced discover)",
  render: () => {
    const [v, setV] = React.useState<SignUpEmailValue>({ email: "" });
    const [isDiscovering, setIsDiscovering] = React.useState(false);
    const [discover, setDiscover] = React.useState<DiscoverResult | null>(null);
    React.useEffect(() => {
      if (!v.email || !v.email.includes("@")) {
        setDiscover(null);
        return;
      }
      setIsDiscovering(true);
      const t = setTimeout(() => {
        const dom = v.email.split("@")[1] ?? "";
        if (dom.startsWith("acme.")) {
          setDiscover({ kind: "existing", orgName: "Acme Industries" });
        } else if (dom.startsWith("globex.")) {
          setDiscover({
            kind: "pending_invite",
            orgName: "Globex Corp",
            inviteId: "inv_01H8YV…",
          });
        } else if (dom.startsWith("okta.")) {
          setDiscover({
            kind: "sso_required",
            orgName: "Okta",
            ssoProvider: "Okta",
          });
        } else {
          setDiscover({ kind: "free" });
        }
        setIsDiscovering(false);
      }, 380);
      return () => clearTimeout(t);
    }, [v.email]);
    return (
      <Frame>
        <SignUpEmail
          value={v}
          onChange={setV}
          discover={discover}
          isDiscovering={isDiscovering}
          onResendInvite={(id) => alert("resend " + id)}
          onSubmit={(val) => alert("continue " + val.email)}
          onSignIn={() => alert("sign in")}
          onSSO={(p) => alert("SSO " + p)}
        />
      </Frame>
    );
  },
};

export const WithError: Story = {
  render: () => (
    <Frame>
      <SignUpEmail
        defaultValue={{ email: "not-an-email" }}
        error="That email doesn't look right"
      />
    </Frame>
  ),
};
