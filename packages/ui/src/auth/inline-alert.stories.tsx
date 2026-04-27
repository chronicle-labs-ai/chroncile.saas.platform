import type { Meta, StoryObj } from "@storybook/react";
import { InlineAlert } from "./_internal";

/*
 * InlineAlert lives in `auth/_internal.tsx` (intra-module helper) but
 * the WorkOS plan calls for the full `tone × {title?, actions?}`
 * matrix to be storybook-covered before the gate clears. So we expose
 * the alert via stories here without re-exporting from the public
 * barrel.
 */

const meta: Meta<typeof InlineAlert> = {
  title: "Auth/InlineAlert",
  component: InlineAlert,
  parameters: { layout: "padded" },
  argTypes: {
    tone: {
      control: "radio",
      options: ["danger", "warning", "info"],
    },
  },
};
export default meta;
type Story = StoryObj<typeof InlineAlert>;

export const DangerSimple: Story = {
  name: "danger · body only",
  render: () => (
    <div className="w-[460px]">
      <InlineAlert tone="danger">
        Those credentials didn&rsquo;t match. Check the password and try again.
      </InlineAlert>
    </div>
  ),
};

export const WarningSimple: Story = {
  name: "warning · body only",
  render: () => (
    <div className="w-[460px]">
      <InlineAlert tone="warning">
        Acme Industries already uses Chronicle.
      </InlineAlert>
    </div>
  ),
};

export const InfoSimple: Story = {
  name: "info · body only",
  render: () => (
    <div className="w-[460px]">
      <InlineAlert tone="info">
        Signed in as <code className="font-mono">ada@stripe.com</code>.
      </InlineAlert>
    </div>
  ),
};

export const WarningWithTitleAndActions: Story = {
  name: "warning · title + actions (A.1c)",
  render: () => (
    <div className="w-[460px]">
      <InlineAlert
        tone="warning"
        title="Looking for an invite?"
        actions={
          <>
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="font-medium text-ink-hi underline-offset-2 hover:underline"
            >
              Go to invite link →
            </a>
            <span className="text-ink-faint">·</span>
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="font-medium text-ink-hi underline-offset-2 hover:underline"
            >
              Sign in instead
            </a>
          </>
        }
      >
        Owner-initiated invites land in your inbox from{" "}
        <code className="font-mono">noreply@workos.com</code>. Sign-ups
        can&rsquo;t join an existing workspace directly.
      </InlineAlert>
    </div>
  ),
};

export const InfoWithTitleAndActions: Story = {
  name: "info · title + actions (A.1p)",
  render: () => (
    <div className="w-[460px]">
      <InlineAlert
        tone="info"
        title="Didn't get the email?"
        actions={
          <>
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="font-medium text-ink-hi underline-offset-2 hover:underline"
            >
              Resend invite →
            </a>
            <span className="text-ink-faint">·</span>
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="font-medium text-ink-hi underline-offset-2 hover:underline"
            >
              Sign in instead
            </a>
          </>
        }
      >
        Resend will revoke the previous token and email a fresh link from{" "}
        <code className="font-mono">noreply@workos.com</code>.
      </InlineAlert>
    </div>
  ),
};

export const DangerWithTitle: Story = {
  name: "danger · title only",
  render: () => (
    <div className="w-[460px]">
      <InlineAlert tone="danger" title="That code didn't match.">
        We&rsquo;ll send a fresh code if you click resend below.
      </InlineAlert>
    </div>
  ),
};

export const InfoTitleOnly: Story = {
  name: "info · title-only (A.4 alert)",
  render: () => (
    <div className="w-[460px]">
      <InlineAlert tone="info" title="Almost there.">
        Signed in as <code className="font-mono">ada@stripe.com</code>.
        We&rsquo;ll provision the workspace and route this email&rsquo;s domain
        to it automatically.
      </InlineAlert>
    </div>
  ),
};

export const Matrix: Story = {
  name: "full matrix (tone × variant)",
  render: () => (
    <div className="flex w-[480px] flex-col gap-s-3">
      <InlineAlert tone="danger">Body only · danger</InlineAlert>
      <InlineAlert tone="warning">Body only · warning</InlineAlert>
      <InlineAlert tone="info">Body only · info</InlineAlert>
      <InlineAlert tone="danger" title="Title">
        Body · danger + title
      </InlineAlert>
      <InlineAlert tone="warning" title="Title">
        Body · warning + title
      </InlineAlert>
      <InlineAlert tone="info" title="Title">
        Body · info + title
      </InlineAlert>
      <InlineAlert
        tone="warning"
        title="Title"
        actions={
          <>
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="font-medium text-ink-hi"
            >
              Action A →
            </a>
            <span className="text-ink-faint">·</span>
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="font-medium text-ink-hi"
            >
              Action B
            </a>
          </>
        }
      >
        Body · warning + title + actions.
      </InlineAlert>
    </div>
  ),
};
