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
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  MailIcon,
  UserIcon,
} from "../icons/glyphs";
import { AuthDisplay, AuthLede, InlineAlert, StepFoot } from "./_internal";

/**
 * SignUpPassword — second sign-up step.
 *
 * Shows the confirmed email (read-only success state) and captures the
 * new user's first name + password with a live strength meter. Submits
 * when score ≥ 2 AND length ≥ 8 by default.
 *
 * The plan's A.2 spec moves first-name capture from the email step to
 * here — `firstName` is part of `SignUpPasswordValue`. Pre-existing
 * call-sites that pass only `{ email, password }` keep working — the
 * first-name field is hidden via the `hideFirstName` prop.
 */

export interface SignUpPasswordValue {
  email: string;
  password: string;
  /** Optional first name captured alongside the password. */
  firstName?: string;
}

export interface SignUpPasswordProps {
  value: SignUpPasswordValue;
  onChange?: (next: SignUpPasswordValue) => void;
  onSubmit?: (value: SignUpPasswordValue) => void;
  onBack?: () => void;
  /** Top-level error banner. */
  error?: string | null;
  /** Submit-in-flight state. */
  isSubmitting?: boolean;
  /** Min score to allow submission (0–4). Default 2. */
  minScore?: 0 | 1 | 2 | 3 | 4;
  /** Min length to allow submission. Default 8. */
  minLength?: number;
  /** Hide the first-name field (legacy callers that capture name on step 1). */
  hideFirstName?: boolean;
}

/**
 * Sign-up step 02 — password creation with the live `PasswordMeter`
 * scoring strip and a show / hide eye toggle.
 */
export function SignUpPassword({
  value,
  onChange,
  onSubmit,
  onBack,
  error = null,
  isSubmitting = false,
  minScore = 2,
  minLength = 8,
  hideFirstName = false,
}: SignUpPasswordProps) {
  const [showPw, setShowPw] = React.useState(false);
  const score = scorePassword(value.password);
  const nameOk = hideFirstName ? true : !!value.firstName?.trim();
  const canSubmit =
    nameOk && score >= minScore && (value.password?.length ?? 0) >= minLength;

  const submit = () => {
    if (canSubmit) onSubmit?.(value);
  };

  return (
    <div className="flex flex-col">
      <Eyebrow>Step 02 · Account</Eyebrow>
      <AuthDisplay>
        Set a <em>strong password.</em>
      </AuthDisplay>
      <AuthLede>It protects every event in your stream.</AuthLede>

      <div className="cg-fade-up cg-fade-up-2 mt-s-8 flex flex-col gap-s-3">
        {error ? <InlineAlert>{error}</InlineAlert> : null}

        <FormField
          tone="auth"
          label={
            <span className="inline-flex items-center gap-[6px]">
              <MailIcon /> Email
            </span>
          }
          htmlFor="auth-pw-email"
        >
          <div className="relative">
            <Input
              id="auth-pw-email"
              type="email"
              value={value.email}
              readOnly
              variant="auth"
              className="pr-[40px]"
            />
            <span
              className="absolute right-[10px] top-1/2 -translate-y-1/2 text-event-green"
              aria-label="Email confirmed"
            >
              <CheckIcon size={12} />
            </span>
          </div>
        </FormField>

        {hideFirstName ? null : (
          <FormField
            tone="auth"
            label={
              <span className="inline-flex items-center gap-[6px]">
                <UserIcon /> First name
              </span>
            }
            htmlFor="auth-pw-firstname"
          >
            <Input
              id="auth-pw-firstname"
              type="text"
              autoComplete="given-name"
              placeholder="Ada"
              variant="auth"
              value={value.firstName ?? ""}
              onChange={(e) =>
                onChange?.({ ...value, firstName: e.currentTarget.value })
              }
              onKeyDown={(e) => e.key === "Enter" && submit()}
              autoFocus
            />
          </FormField>
        )}

        <FormField
          tone="auth"
          label={
            <span className="inline-flex items-center gap-[6px]">
              <LockIcon /> Password
            </span>
          }
          htmlFor="auth-pw-password"
        >
          <div className="relative">
            <Input
              id="auth-pw-password"
              type={showPw ? "text" : "password"}
              autoComplete="new-password"
              placeholder="At least 8 characters · One number or symbol"
              variant="auth"
              value={value.password}
              onChange={(e) =>
                onChange?.({ ...value, password: e.currentTarget.value })
              }
              onKeyDown={(e) => e.key === "Enter" && submit()}
              autoFocus={hideFirstName}
              className="pr-[40px]"
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              aria-label={showPw ? "Hide password" : "Show password"}
              className="absolute right-[10px] top-1/2 -translate-y-1/2 text-ink-dim hover:text-ink-hi transition-colors"
            >
              {showPw ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </FormField>

        {value.password ? <PasswordMeter value={value.password} /> : null}
      </div>

      <StepFoot
        back={
          <Button
            variant="ghost"
            onPress={onBack}
            leadingIcon={<ArrowLeftIcon />}
          >
            Back
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
            Continue
          </Button>
        }
      />
    </div>
  );
}
