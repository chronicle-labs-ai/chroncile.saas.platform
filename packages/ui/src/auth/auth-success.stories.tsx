import type { Meta, StoryObj } from "@storybook/react";
import { AuthSuccess } from "./auth-success";
import { AuthShell } from "./auth-shell";

const meta: Meta<typeof AuthSuccess> = {
  title: "Auth/AuthSuccess",
  component: AuthSuccess,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof AuthSuccess>;

export const Default: Story = {
  render: () => (
    <AuthShell topbar={false} bare>
      <AuthSuccess
        caption={<span className="text-ink-lo">chronicle.app/inbox</span>}
      />
    </AuthShell>
  ),
};

export const Welcome: Story = {
  render: () => (
    <AuthShell topbar={false} bare>
      <AuthSuccess
        headline={
          <>
            Welcome <em>back,</em> Ada.
          </>
        }
        message="Loading your workspace…"
        hideSpinner={false}
      />
    </AuthShell>
  ),
};

/* ── A.6 — workspace-ready greeting variant ─────────────────── */

export const A6WorkspaceReady: Story = {
  name: "A.6 · workspace-ready greeting",
  render: () => (
    <AuthShell topbar={false} bare>
      <AuthSuccess
        headline={
          <>
            You&rsquo;re in, <em>Ada.</em>
          </>
        }
        message={
          <>
            <b className="text-ink-hi font-medium">Stripe Events</b> is
            provisioned and your session is signed.
          </>
        }
        caption={
          <span className="text-ink-lo">
            Routing to{" "}
            <code className="font-mono">chronicle.app/dashboard</code>…
          </span>
        }
      />
    </AuthShell>
  ),
};

export const NoSpinner: Story = {
  render: () => (
    <AuthShell topbar={false} bare>
      <AuthSuccess
        headline={<>Saved.</>}
        message="Your changes will sync momentarily."
        hideSpinner
      />
    </AuthShell>
  ),
};
