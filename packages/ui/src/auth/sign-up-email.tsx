"use client";

import * as React from "react";
import { Button } from "../primitives/button";
import { Eyebrow } from "../primitives/eyebrow";
import { FormField } from "../primitives/form-field";
import { Input } from "../primitives/input";
import { OrDivider } from "../primitives/or-divider";
import { SSOButton } from "../primitives/sso-button";
import { ArrowRightIcon, MailIcon } from "../icons/glyphs";
import { DomainStrip } from "./domain-detect";
import {
  AuthDisplay,
  AuthLede,
  InlineAlert,
  isValidEmail,
  StepFoot,
} from "./_internal";

/**
 * SignUpEmail — first sign-up step (single-mode, prototype-anchored).
 *
 * The structured / freeform / template tabs from the v2 sign-up flow
 * are gone — the WorkOS migration is single-mode (just an email).
 * `name` and `password` move to step 2.
 *
 * Domain discovery is driven by the `discover` prop. As the user types,
 * the parent debounces a call to `/api/auth/discover?email=…` and feeds
 * the result back in via `discover`. Four sub-states render via the
 * shared `<DomainStrip>` component:
 *
 *   • free          — A.1   tone="match"   "<domain> — no existing workspace…"
 *   • existing      — A.1c  tone="warn"    "<orgName> already uses Chronicle…"
 *   • pending_invite — A.1p tone="warn"    "You have a pending invite from <orgName>…"
 *   • sso_required  — A.1s  tone="sso"     "<orgName> uses single sign-on…"
 *
 * On A.1c the Continue button disables and an InlineAlert with the
 * "Looking for an invite?" actions appears. On A.1p the alert flips to
 * "Didn't get the email?" with a Resend invite action. On A.1s the
 * password-aware "Continue" CTA is replaced by a single SSO button.
 */

export type SignUpPersona = "sales" | "engineer" | "founder" | "signup";

export interface SignUpEmailValue {
  email: string;
}

export interface DiscoverResult {
  kind: "free" | "existing" | "pending_invite" | "sso_required";
  /** Used in the warn / sso copy. */
  orgName?: string;
  /** Used in the sso_required copy + button label. */
  ssoProvider?: string;
  /** Used by `onResendInvite`. */
  inviteId?: string;
}

export interface SignUpEmailProps {
  value?: SignUpEmailValue;
  defaultValue?: Partial<SignUpEmailValue>;
  onChange?: (next: SignUpEmailValue) => void;
  onSubmit?: (value: SignUpEmailValue) => void;
  onSignIn?: () => void;
  onSSO?: (provider: "google" | "github" | "saml") => void;
  ssoLoading?: "google" | "github" | "saml" | null;
  /** Top-level error banner. */
  error?: string | null;
  /** Submit-in-flight state. */
  isSubmitting?: boolean;
  /** Persona affects the eyebrow + headline copy. */
  persona?: SignUpPersona;
  /**
   * Latest discover result. `null` / `undefined` → render the empty
   * email-only state. Setting a value drives the A.1 / A.1c / A.1p /
   * A.1s sub-states.
   */
  discover?: DiscoverResult | null;
  /** Whether `/api/auth/discover` is in-flight (debounce window). */
  isDiscovering?: boolean;
  /** Resend a pending WorkOS invitation. Receives the inviteId. */
  onResendInvite?: (inviteId: string) => void;
  /**
   * "Sign in instead" CTA in the A.1c (existing-workspace) alert.
   * Falls back to `onSignIn` when omitted, so single-handler callers
   * keep working.
   */
  onSignInInstead?: () => void;
  /**
   * "Sign in instead" CTA in the A.1p (pending-invite) alert. Lets
   * design route the two prompts to distinct destinations (e.g. a
   * pending invite-aware sign-in page that pre-fills the email).
   * Falls back to `onSignInInstead`, then `onSignIn`.
   */
  onSignInPending?: () => void;
}

const PERSONA_COPY: Record<
  SignUpPersona,
  {
    eyebrow: React.ReactNode;
    title: React.ReactNode;
    lede: React.ReactNode;
    emailLabel: string;
  }
> = {
  signup: {
    eyebrow: "Step 01 · Email",
    title: (
      <>
        Start your <em>workspace.</em>
      </>
    ),
    lede: "We'll detect your workspace and route you to the right place.",
    emailLabel: "Work email",
  },
  founder: {
    eyebrow: "Step 01 · Email",
    title: (
      <>
        Build your <em>company&rsquo;s stream.</em>
      </>
    ),
    lede: "Two minutes to set up. We'll wire your team's first events together.",
    emailLabel: "Work email",
  },
  sales: {
    eyebrow: "Step 01 · Email",
    title: (
      <>
        Start your <em>workspace.</em>
      </>
    ),
    lede: "Two minutes, then your sales events stream live.",
    emailLabel: "Work email",
  },
  engineer: {
    eyebrow: "Step 01 · Email",
    title: (
      <>
        Provision a <em>workspace.</em>
      </>
    ),
    lede: "Three steps. Then drop in your SDK key and start emitting events.",
    emailLabel: "Work email",
  },
};

function deriveDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at >= 0 ? email.slice(at + 1) : email;
}

/**
 * Sign-up step 01 — email capture with the discover-driven domain
 * strip below the field.
 */
export function SignUpEmail({
  value,
  defaultValue,
  onChange,
  onSubmit,
  onSignIn,
  onSSO,
  ssoLoading = null,
  error = null,
  isSubmitting = false,
  persona = "signup",
  discover = null,
  isDiscovering = false,
  onResendInvite,
  onSignInInstead,
  onSignInPending,
}: SignUpEmailProps) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = React.useState<SignUpEmailValue>({
    email: defaultValue?.email ?? "",
  });
  const v = isControlled ? value! : internal;
  const set = (next: SignUpEmailValue) => {
    if (!isControlled) setInternal(next);
    onChange?.(next);
  };

  const copy = PERSONA_COPY[persona];
  const [emailErr, setEmailErr] = React.useState<string | null>(null);

  const submit = () => {
    setEmailErr(null);
    if (!isValidEmail(v.email)) {
      setEmailErr("That email doesn't look right");
      return;
    }
    onSubmit?.(v);
  };

  const isSSO = discover?.kind === "sso_required";
  const isCollision = discover?.kind === "existing";
  const isPendingInvite = discover?.kind === "pending_invite";
  const orgName = discover?.orgName ?? "your workspace";

  /* Sign-in fallback chain: each alert tries its specific handler
   * first, then walks up through the more general ones so single-
   * handler callers keep compiling. */
  const handleSignInExisting = onSignInInstead ?? onSignIn;
  const handleSignInPending = onSignInPending ?? onSignInInstead ?? onSignIn;

  const canSubmit = isValidEmail(v.email) && !isCollision && !isSSO;

  /* When we're in the SSO sub-state the headline switches per the
   * prototype to "Sign in to <orgName>". */
  const heroTitle = isSSO ? (
    <>
      Sign in to <em>{orgName}</em>
    </>
  ) : (
    copy.title
  );

  return (
    <div className="flex flex-col">
      <Eyebrow>{copy.eyebrow}</Eyebrow>
      <AuthDisplay>{heroTitle}</AuthDisplay>
      <AuthLede>{copy.lede}</AuthLede>

      <div className="cg-fade-up cg-fade-up-2 mt-s-8 flex flex-col gap-s-3">
        {error ? <InlineAlert>{error}</InlineAlert> : null}

        {/* SSO row stays on the email step for users who never had a
            password (Google / GitHub / SAML). When we know the org
            requires SSO (A.1s), we hide the Google/GitHub row in
            favor of the dedicated SSO CTA below. */}
        {!isSSO ? (
          <>
            <div className="flex flex-col gap-s-2">
              <SSOButton
                provider="google"
                onPress={() => onSSO?.("google")}
                isLoading={ssoLoading === "google"}
                isDisabled={
                  isSubmitting || (!!ssoLoading && ssoLoading !== "google")
                }
              />
              <SSOButton
                provider="github"
                onPress={() => onSSO?.("github")}
                isLoading={ssoLoading === "github"}
                isDisabled={
                  isSubmitting || (!!ssoLoading && ssoLoading !== "github")
                }
              />
            </div>
            <OrDivider label="or sign up with email" />
          </>
        ) : null}

        <FormField
          tone="auth"
          label={
            <span className="inline-flex items-center gap-[6px]">
              <MailIcon /> {copy.emailLabel}
            </span>
          }
          htmlFor="auth-signup-email"
          error={emailErr ?? undefined}
        >
          <Input
            id="auth-signup-email"
            type="email"
            autoComplete="email"
            placeholder="ada@company.com"
            variant="auth"
            invalid={!!emailErr}
            value={v.email}
            onChange={(e) => set({ ...v, email: e.currentTarget.value })}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            autoFocus
          />
        </FormField>

        {/* Discover-driven strip — surfaces the four sub-states. */}
        {v.email ? (
          isDiscovering ? (
            <DomainStrip
              tone="neutral"
              label={
                <span>
                  Checking{" "}
                  <b className="text-ink-hi">{deriveDomain(v.email)}</b>…
                </span>
              }
            />
          ) : discover ? (
            <DiscoverStrip discover={discover} email={v.email} />
          ) : null
        ) : null}

        {/* Invite-recovery alerts — appear below the strip on the warn
            sub-states. */}
        {isCollision ? (
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
                <button
                  type="button"
                  onClick={handleSignInExisting}
                  className="font-medium text-ink-hi underline-offset-2 hover:underline"
                >
                  Sign in instead
                </button>
              </>
            }
          >
            Owner-initiated invites land in your inbox from{" "}
            <code className="font-mono">noreply@workos.com</code>. If you
            can&rsquo;t find one, ask your admin to send you one — sign-ups
            can&rsquo;t join an existing workspace directly.
          </InlineAlert>
        ) : null}

        {isPendingInvite ? (
          <InlineAlert
            tone="info"
            title="Didn't get the email?"
            actions={
              <>
                <button
                  type="button"
                  disabled={!discover?.inviteId || !onResendInvite}
                  onClick={() => {
                    if (discover?.inviteId) onResendInvite?.(discover.inviteId);
                  }}
                  className="font-medium text-ink-hi underline-offset-2 hover:underline disabled:text-ink-faint"
                >
                  Resend invite →
                </button>
                <span className="text-ink-faint">·</span>
                <button
                  type="button"
                  onClick={handleSignInPending}
                  className="font-medium text-ink-hi underline-offset-2 hover:underline"
                >
                  Sign in instead
                </button>
              </>
            }
          >
            Resend will revoke the previous token and email a fresh link from{" "}
            <code className="font-mono">noreply@workos.com</code>.
          </InlineAlert>
        ) : null}
      </div>

      <StepFoot
        back={
          <Button variant="ghost" onPress={onSignIn}>
            Already have an account? Sign in
          </Button>
        }
        next={
          isSSO ? (
            <Button
              variant="ember"
              isLoading={ssoLoading === "saml"}
              onPress={() => onSSO?.("saml")}
              trailingIcon={ssoLoading === "saml" ? null : <ArrowRightIcon />}
            >
              {`Sign in with ${orgName} SSO`}
            </Button>
          ) : (
            <Button
              variant="ember"
              isLoading={isSubmitting}
              isDisabled={!canSubmit}
              onPress={submit}
              trailingIcon={!isSubmitting && <ArrowRightIcon />}
            >
              Continue
            </Button>
          )
        }
      />

      <p className="mt-s-4 font-sans text-[12px] text-ink-dim">
        By continuing you agree to Chronicle&rsquo;s{" "}
        <a href="#" className="underline underline-offset-2 hover:text-ink-lo">
          Terms
        </a>{" "}
        and{" "}
        <a href="#" className="underline underline-offset-2 hover:text-ink-lo">
          Privacy Policy
        </a>
        .
      </p>
    </div>
  );
}

function DiscoverStrip({
  discover,
  email,
}: {
  discover: DiscoverResult;
  email: string;
}) {
  const orgName = discover.orgName ?? "your workspace";
  const ssoProvider = discover.ssoProvider ?? "your IdP";
  switch (discover.kind) {
    case "free":
      return (
        <DomainStrip
          tone="match"
          label={
            <>
              <b className="text-ink-hi">{deriveDomain(email)}</b> — no existing
              workspace. You&rsquo;ll create a new one.
            </>
          }
        />
      );
    case "existing":
      return (
        <DomainStrip
          tone="warn"
          orgName={discover.orgName}
          label={
            <>
              <b className="text-ink-hi">{orgName}</b> already uses Chronicle.
              If you were invited, check your inbox for an invite from your
              admin.
            </>
          }
        />
      );
    case "pending_invite":
      return (
        <DomainStrip
          tone="warn"
          orgName={discover.orgName}
          label={
            <>
              You have a pending invite from{" "}
              <b className="text-ink-hi">{orgName}</b> — check your email for
              the link from{" "}
              <code className="font-mono">noreply@workos.com</code>.
            </>
          }
        />
      );
    case "sso_required":
      return (
        <DomainStrip
          tone="sso"
          orgName={discover.orgName}
          label={
            <>
              <b className="text-ink-hi">{orgName}</b> uses single sign-on.
              You&rsquo;ll be redirected to{" "}
              <b className="text-ink-hi">{ssoProvider}</b> to continue.
            </>
          }
        />
      );
  }
}
