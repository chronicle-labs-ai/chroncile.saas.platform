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
} from "../icons/glyphs";
import {
  AuthDisplay,
  AuthLede,
  InlineAlert,
  StepFoot,
  SuccessSeal,
} from "./_internal";

export interface ResetPasswordValue {
  password: string;
  confirmPassword: string;
}

export interface ResetPasswordProps {
  value?: ResetPasswordValue;
  defaultValue?: Partial<ResetPasswordValue>;
  onChange?: (next: ResetPasswordValue) => void;
  onSubmit?: (newPassword: string) => void;
  onContinue?: () => void;
  done?: boolean;
  error?: string | null;
  isSubmitting?: boolean;
  minScore?: 0 | 1 | 2 | 3 | 4;
  minLength?: number;
  email?: string;
}

/**
 * Reset password screen — sets a new password using the token from the
 * recovery email. Toggles to a confirmation state via the `done` prop.
 */
export function ResetPassword({
  value,
  defaultValue,
  onChange,
  onSubmit,
  onContinue,
  done = false,
  error = null,
  isSubmitting = false,
  minScore = 2,
  minLength = 8,
  email,
}: ResetPasswordProps) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = React.useState<ResetPasswordValue>({
    password: defaultValue?.password ?? "",
    confirmPassword: defaultValue?.confirmPassword ?? "",
  });
  const v = isControlled ? value! : internal;
  const set = (next: ResetPasswordValue) => {
    if (!isControlled) setInternal(next);
    onChange?.(next);
  };

  const [showPw, setShowPw] = React.useState(false);
  const [confirmErr, setConfirmErr] = React.useState<string | null>(null);

  const score = scorePassword(v.password);
  const passwordLongEnough = v.password.length >= minLength;
  const passwordsMatch =
    v.confirmPassword.length > 0 && v.password === v.confirmPassword;
  const canSubmit =
    passwordLongEnough && score >= minScore && passwordsMatch;

  const submit = () => {
    setConfirmErr(null);
    if (!passwordLongEnough || score < minScore) return;
    if (!passwordsMatch) {
      setConfirmErr("Passwords don't match");
      return;
    }
    onSubmit?.(v.password);
  };

  if (done) {
    return (
      <div className="flex flex-col">
        <Eyebrow>RECOVERY</Eyebrow>
        <AuthDisplay>
          Password <em>updated.</em>
        </AuthDisplay>
        <AuthLede>
          {email ? (
            <>
              You can now sign in to{" "}
              <b className="text-ink-hi font-medium">{email}</b> with your new
              password. All previous sessions on other devices have been signed
              out.
            </>
          ) : (
            <>
              You can now sign in with your new password. All previous sessions
              on other devices have been signed out.
            </>
          )}
        </AuthLede>

        <div className="cg-fade-up cg-fade-up-2 mt-s-8">
          <SuccessSeal static />
        </div>

        <StepFoot
          back={null}
          next={
            <Button
              variant="ember"
              onPress={onContinue}
              trailingIcon={<ArrowRightIcon />}
            >
              Continue to sign in
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <Eyebrow>RECOVERY</Eyebrow>
      <AuthDisplay>
        Set a new <em>password.</em>
      </AuthDisplay>
      <AuthLede>
        {email ? (
          <>
            Choose a strong password for{" "}
            <b className="text-ink-hi font-medium">{email}</b>.
          </>
        ) : (
          <>Choose a strong password — it protects every event in your stream.</>
        )}
      </AuthLede>

      <div className="cg-fade-up cg-fade-up-2 mt-s-8 flex flex-col gap-s-3">
        {error ? <InlineAlert>{error}</InlineAlert> : null}

        <FormField
          tone="auth"
          label={
            <span className="inline-flex items-center gap-[6px]">
              <LockIcon /> New password
            </span>
          }
          htmlFor="auth-reset-password"
        >
          <div className="relative">
            <Input
              id="auth-reset-password"
              type={showPw ? "text" : "password"}
              autoComplete="new-password"
              placeholder="At least 8 characters · One number or symbol"
              variant="auth"
              value={v.password}
              onChange={(e) =>
                set({ ...v, password: e.currentTarget.value })
              }
              onKeyDown={(e) => e.key === "Enter" && submit()}
              autoFocus
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

        {v.password ? <PasswordMeter value={v.password} /> : null}

        <FormField
          tone="auth"
          label={
            <span className="inline-flex items-center gap-[6px]">
              <LockIcon /> Confirm new password
            </span>
          }
          htmlFor="auth-reset-confirm"
          error={confirmErr ?? undefined}
        >
          <div className="relative">
            <Input
              id="auth-reset-confirm"
              type={showPw ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Re-enter the password"
              variant="auth"
              invalid={!!confirmErr}
              value={v.confirmPassword}
              onChange={(e) => {
                setConfirmErr(null);
                set({ ...v, confirmPassword: e.currentTarget.value });
              }}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="pr-[40px]"
            />
            {passwordsMatch ? (
              <span
                className="absolute right-[10px] top-1/2 -translate-y-1/2 text-event-green"
                aria-label="Passwords match"
              >
                <CheckIcon size={12} />
              </span>
            ) : null}
          </div>
        </FormField>
      </div>

      <StepFoot
        back={
          <Button
            variant="ghost"
            onPress={onContinue}
            leadingIcon={<ArrowLeftIcon />}
          >
            Back to sign in
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
            Update password
          </Button>
        }
      />
    </div>
  );
}
