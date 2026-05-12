"use client";

import * as React from "react";
import { Button } from "../primitives/button";
import { Eyebrow } from "../primitives/eyebrow";
import { FormField } from "../primitives/form-field";
import { Input } from "../primitives/input";
import { PasswordMeter, scorePassword } from "../primitives/password-meter";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  MailIcon,
  UserIcon,
} from "../icons/glyphs";
import { Body } from "../typography/body";
import { Display } from "../typography/display";
import { AuthDisplay, AuthLede, InlineAlert, StepFoot } from "./_internal";

/*
 * AcceptInvite — page-shaped composite covering the two B-scenario
 * sub-states the prototype defines:
 *
 *   • B.2 — sign-up path (no existing WorkOS user). Captures first
 *           name + password. Email field is read-only with a
 *           "FROM INVITE" badge.
 *   • B.3 — sign-in path (existing WorkOS user). Captures password
 *           only. Welcome-back framing; no badge on the email.
 *
 * The component is pure presentation — the parent owns the actual
 * `userManagement.acceptInvitation` call (and, for B.3, the
 * `authenticateWithPassword` step that runs first).
 */

export interface AcceptInviteValue {
  /** Used in B.2 (signup) only; ignored in B.3. */
  firstName?: string;
  password: string;
}

export interface AcceptInviteProps {
  /**
   * Drives the variant. `"signup"` ⇒ B.2 (new user — capture name + password).
   * `"signin"` ⇒ B.3 (existing user — capture password only).
   */
  mode: "signup" | "signin";
  /** Pre-filled email read-only from the invite. */
  email: string;
  /** Workspace name (used in the headline + lede). */
  orgName: string;
  /** Inviter's display name (e.g. "Marisol Vega"). */
  inviterName?: string;
  /**
   * Inviter's avatar gradient seed — for the small inviter pill above
   * the heading. Optional; falls back to `inviterName`.
   */
  inviterAvatarSeed?: string;
  /**
   * Existing user's first name for the "Welcome back, <firstName>"
   * headline (B.3 only). Falls back to derived from email if absent.
   */
  firstName?: string;
  onSubmit?: (value: AcceptInviteValue) => void;
  onCancel?: () => void;
  error?: string | null;
  isSubmitting?: boolean;
  /** Min password score in signup mode. Default 2. */
  minScore?: 0 | 1 | 2 | 3 | 4;
  /** Min password length in signup mode. Default 8. */
  minLength?: number;
}

const INVITER_GRADIENTS = [
  "linear-gradient(135deg, #d8430a 0%, #905838 100%)",
  "linear-gradient(135deg, #905838 0%, #b09b74 100%)",
  "linear-gradient(135deg, #709188 0%, #3e547c 100%)",
  "linear-gradient(135deg, #b09b74 0%, #786e68 100%)",
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function gradientFor(seed: string) {
  return (
    INVITER_GRADIENTS[hash(seed) % INVITER_GRADIENTS.length] ??
    INVITER_GRADIENTS[0]
  );
}

/**
 * Page-shaped composite for `app/(auth)/accept-invite/[token]`.
 * Branches B.2 sign-up vs B.3 sign-in on the `mode` prop.
 */
export function AcceptInvite({
  mode,
  email,
  orgName,
  inviterName,
  inviterAvatarSeed,
  firstName,
  onSubmit,
  onCancel,
  error = null,
  isSubmitting = false,
  minScore = 2,
  minLength = 8,
}: AcceptInviteProps) {
  const [val, setVal] = React.useState<AcceptInviteValue>({
    firstName: "",
    password: "",
  });
  const [showPw, setShowPw] = React.useState(false);

  const score = scorePassword(val.password);
  const canSubmitSignup =
    !!val.firstName?.trim() &&
    score >= minScore &&
    (val.password?.length ?? 0) >= minLength;
  const canSubmitSignin = (val.password?.length ?? 0) >= 1;
  const canSubmit = mode === "signup" ? canSubmitSignup : canSubmitSignin;

  const submit = () => {
    if (canSubmit) onSubmit?.(val);
  };

  const inviterSeed = inviterAvatarSeed || inviterName || orgName;
  const inviterInitial = (inviterName || orgName).charAt(0).toUpperCase();
  const greeting =
    firstName?.trim() ||
    (email && email.includes("@") ? email.split("@")[0] : "back");

  return (
    <div className="flex flex-col gap-s-6">
      <Eyebrow>
        Accept invite · <b className="text-ink-hi">{mode === "signup" ? "New user" : "Existing user"}</b>
      </Eyebrow>

      {inviterName ? (
        <div
          className={
            "cg-fade-up mt-s-3 inline-flex w-fit items-center gap-s-2 rounded-pill " +
            "border border-hairline-strong bg-surface-01 px-s-3 py-s-1 " +
            "font-mono text-mono-sm text-ink-lo"
          }
        >
          <span
            aria-hidden
            className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-pill text-ink-inv-hi font-display text-[11px] leading-none"
            style={{ background: gradientFor(inviterSeed) }}
          >
            {inviterInitial}
          </span>
          <span>
            <b className="text-ink-hi">{inviterName}</b> invited you to{" "}
            <b className="text-ink-hi">{orgName}</b>
          </span>
        </div>
      ) : null}

      {mode === "signup" ? (
        <>
          <Display as="h1" size="md" className="cg-fade-up">
            Join <em className="italic font-normal text-bone">{orgName}.</em>
          </Display>
          <Body
            as="p"
            size="md"
            tone="lo"
            className="cg-fade-up cg-fade-up-1 mt-s-4 max-w-[52ch]"
          >
            {`${inviterName ? `${inviterName} ` : "An admin "}assigned you a role on ${orgName}. Set up your account to accept the invite.`}
          </Body>
        </>
      ) : (
        <>
          <AuthDisplay>
            Welcome back, <em>{greeting}.</em>
          </AuthDisplay>
          <AuthLede>{`Sign in to accept your invite to ${orgName}.`}</AuthLede>
        </>
      )}

      <div className="cg-fade-up cg-fade-up-2 mt-s-8 flex flex-col gap-s-3">
        {error ? <InlineAlert>{error}</InlineAlert> : null}

        <FormField
          tone="auth"
          label={
            <span className="inline-flex items-center gap-[6px]">
              <MailIcon /> Email
            </span>
          }
          htmlFor="auth-invite-email"
        >
          <div className="relative">
            <Input
              id="auth-invite-email"
              type="email"
              value={email}
              readOnly
              variant="auth"
              className={mode === "signup" ? "pr-[110px]" : ""}
            />
            {mode === "signup" ? (
              <span
                className={
                  "absolute right-[8px] top-1/2 -translate-y-1/2 " +
                  "rounded-xs border border-hairline-strong bg-surface-02 px-s-2 py-[2px] " +
                  "font-mono text-mono-sm uppercase tracking-tactical text-ember"
                }
              >
                FROM INVITE
              </span>
            ) : null}
          </div>
        </FormField>

        {mode === "signup" ? (
          <FormField
            tone="auth"
            label={
              <span className="inline-flex items-center gap-[6px]">
                <UserIcon /> First name
              </span>
            }
            htmlFor="auth-invite-name"
          >
            <Input
              id="auth-invite-name"
              type="text"
              autoComplete="given-name"
              placeholder="Ada"
              variant="auth"
              value={val.firstName ?? ""}
              onChange={(e) =>
                setVal({ ...val, firstName: e.currentTarget.value })
              }
              onKeyDown={(e) => e.key === "Enter" && submit()}
              autoFocus
            />
          </FormField>
        ) : null}

        <FormField
          tone="auth"
          label={
            <span className="inline-flex items-center gap-[6px]">
              <LockIcon /> {mode === "signup" ? "Set a password" : "Password"}
            </span>
          }
          htmlFor="auth-invite-password"
        >
          <div className="relative">
            <Input
              id="auth-invite-password"
              type={showPw ? "text" : "password"}
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              placeholder={
                mode === "signup" ? "At least 8 characters" : "••••••••••"
              }
              variant="auth"
              value={val.password}
              onChange={(e) =>
                setVal({ ...val, password: e.currentTarget.value })
              }
              onKeyDown={(e) => e.key === "Enter" && submit()}
              autoFocus={mode === "signin"}
              className="pr-[40px]"
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              aria-label={showPw ? "Hide password" : "Show password"}
              className="absolute right-[10px] top-1/2 -translate-y-1/2 text-ink-dim transition-colors hover:text-ink-hi"
            >
              {showPw ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </FormField>

        {mode === "signup" && val.password ? (
          <PasswordMeter value={val.password} />
        ) : null}
      </div>

      <StepFoot
        back={
          <Button
            variant="ghost"
            onPress={onCancel}
            leadingIcon={<ArrowLeftIcon />}
          >
            Cancel
          </Button>
        }
        next={
          <Button
            variant="ember"
            isLoading={isSubmitting}
            isDisabled={!canSubmit}
            onPress={submit}
            trailingIcon={!isSubmitting && <ArrowRightIcon />}
          >
            {mode === "signup"
              ? `Accept and join ${orgName}`
              : `Accept and sign in`}
          </Button>
        }
      />
    </div>
  );
}
