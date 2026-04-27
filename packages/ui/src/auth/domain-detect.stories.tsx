import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { DomainDetect, DomainStrip } from "./domain-detect";
import { detectDomain } from "../onboarding/data";

const meta: Meta<typeof DomainDetect> = {
  title: "Auth/DomainDetect",
  component: DomainDetect,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof DomainDetect>;

export const Idle: Story = {
  render: () => (
    <div className="w-[460px]">
      <DomainDetect hasEmail={false} />
    </div>
  ),
};

export const Parsing: Story = {
  render: () => (
    <div className="w-[460px]">
      <DomainDetect hasEmail parsing />
    </div>
  ),
};

export const Match: Story = {
  render: () => (
    <div className="w-[460px]">
      <DomainDetect hasEmail match={detectDomain("ada@stripe.com")} />
    </div>
  ),
};

export const NoMatch: Story = {
  render: () => (
    <div className="w-[460px]">
      <DomainDetect hasEmail match={null} />
    </div>
  ),
};

export const Live: Story = {
  render: () => {
    const [email, setEmail] = React.useState("");
    const [parsing, setParsing] = React.useState(false);
    const [match, setMatch] =
      React.useState<ReturnType<typeof detectDomain>>(null);
    React.useEffect(() => {
      if (!email) {
        setMatch(null);
        setParsing(false);
        return;
      }
      setParsing(true);
      const id = setTimeout(() => {
        setMatch(detectDomain(email));
        setParsing(false);
      }, 380);
      return () => clearTimeout(id);
    }, [email]);
    return (
      <div className="flex w-[460px] flex-col gap-s-3">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Try ada@stripe.com or me@anthropic.com"
          className="rounded-sm border border-hairline-strong bg-surface-00 px-s-3 py-s-2 font-mono text-mono-lg text-ink outline-none focus:border-ember"
        />
        <DomainDetect
          hasEmail={Boolean(email)}
          parsing={parsing}
          match={match}
        />
      </div>
    );
  },
};

/* ── DomainStrip ─────────────────────────────────────────────
   The discover-driven sibling. Tone-keyed banner that surfaces
   /api/auth/discover results: free / existing / pending_invite /
   sso_required (A.1 / A.1c / A.1p / A.1s + D.2). */

export const StripMatch: Story = {
  name: "Strip · tone=match (A.1 free)",
  render: () => (
    <div className="w-[460px]">
      <DomainStrip
        tone="match"
        label={
          <>
            <b className="text-ink-hi">stripe.com</b> — no existing workspace.
            You&rsquo;ll create a new one.
          </>
        }
      />
    </div>
  ),
};

export const StripWarnExisting: Story = {
  name: "Strip · tone=warn (A.1c collision)",
  render: () => (
    <div className="w-[460px]">
      <DomainStrip
        tone="warn"
        orgName="Acme Industries"
        label={
          <>
            <b className="text-ink-hi">Acme Industries</b> already uses
            Chronicle. If you were invited, check your inbox for an invite from
            your admin.
          </>
        }
      />
    </div>
  ),
};

export const StripWarnPendingInvite: Story = {
  name: "Strip · tone=warn (A.1p pending invite)",
  render: () => (
    <div className="w-[460px]">
      <DomainStrip
        tone="warn"
        orgName="Acme Industries"
        label={
          <>
            You have a pending invite from{" "}
            <b className="text-ink-hi">Acme Industries</b> — check your email
            for the link from{" "}
            <code className="font-mono">noreply@workos.com</code>.
          </>
        }
      />
    </div>
  ),
};

export const StripSSO: Story = {
  name: "Strip · tone=sso (A.1s / D.2)",
  render: () => (
    <div className="w-[460px]">
      <DomainStrip
        tone="sso"
        orgName="Acme Industries"
        label={
          <>
            <b className="text-ink-hi">Acme Industries</b> uses single sign-on.
            You&rsquo;ll be redirected to <b className="text-ink-hi">Okta</b> to
            continue.
          </>
        }
      />
    </div>
  ),
};

export const StripNeutral: Story = {
  name: "Strip · tone=neutral",
  render: () => (
    <div className="w-[460px]">
      <DomainStrip
        tone="neutral"
        label="Type a work email to discover your workspace."
      />
    </div>
  ),
};

export const StripAllTones: Story = {
  name: "Strip · all tones stack",
  render: () => (
    <div className="flex w-[460px] flex-col gap-s-3">
      <DomainStrip
        tone="match"
        label={
          <>
            <b className="text-ink-hi">stripe.com</b> — no existing workspace.
          </>
        }
      />
      <DomainStrip
        tone="warn"
        label={
          <>
            <b className="text-ink-hi">Acme Industries</b> already uses
            Chronicle.
          </>
        }
      />
      <DomainStrip
        tone="sso"
        label={
          <>
            <b className="text-ink-hi">Acme Industries</b> uses single sign-on.
          </>
        }
      />
      <DomainStrip
        tone="neutral"
        label="Type a work email to discover your workspace."
      />
    </div>
  ),
};
