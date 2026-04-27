"use client";

import * as React from "react";
import { Button } from "../primitives/button";
import { Eyebrow } from "../primitives/eyebrow";
import { FormField } from "../primitives/form-field";
import { Input } from "../primitives/input";
import { ArrowLeftIcon, ArrowRightIcon, MailIcon } from "../icons/glyphs";
import {
  AuthDisplay,
  AuthLede,
  InlineAlert,
  isValidEmail,
  StepFoot,
  SuccessSeal,
} from "./_internal";

/*
 * ForgotPassword — single-field email capture with a confirmation
 * card after submit. The parent owns the actual reset email send;
 * this component flips into the success state when `sent` is true
 * (or via internal state if `sent` is undefined).
 */

export interface ForgotPasswordProps {
  /** Controlled email value. */
  value?: string;
  defaultValue?: string;
  onChange?: (next: string) => void;
  /** Submit handler — receives the entered email. */
  onSubmit?: (email: string) => void;
  onBack?: () => void;
  /** When true, renders the "check your inbox" confirmation card. */
  sent?: boolean;
  /** Top-level error banner. */
  error?: string | null;
  /** Submit-in-flight state. */
  isSubmitting?: boolean;
}

/**
 * Forgot-password screen — single email field with an inline
 * "check your inbox" confirmation card after submit. Toggle via
 * the `sent` prop, or let the component manage it locally.
 */
export function ForgotPassword({
  value,
  defaultValue = "",
  onChange,
  onSubmit,
  onBack,
  sent: sentProp,
  error = null,
  isSubmitting = false,
}: ForgotPasswordProps) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = React.useState(defaultValue);
  const v = isControlled ? value! : internal;
  const set = (next: string) => {
    if (!isControlled) setInternal(next);
    onChange?.(next);
  };

  const [internalSent, setInternalSent] = React.useState(false);
  const sent = sentProp !== undefined ? sentProp : internalSent;

  const [emailErr, setEmailErr] = React.useState<string | null>(null);

  const submit = () => {
    setEmailErr(null);
    if (!isValidEmail(v)) {
      setEmailErr("That email doesn't look right");
      return;
    }
    if (sentProp === undefined) setInternalSent(true);
    onSubmit?.(v);
  };

  if (sent) {
    return (
      <div className="flex flex-col">
        <Eyebrow>RECOVERY</Eyebrow>
        <AuthDisplay>
          Check your <em>inbox.</em>
        </AuthDisplay>
        <AuthLede>
          We sent reset instructions to{" "}
          <b className="text-ink-hi font-medium">{v || "your email"}</b>. The
          link expires in 30 minutes.
        </AuthLede>

        <div className="cg-fade-up cg-fade-up-2 mt-s-8">
          <SuccessSeal static />
        </div>

        <StepFoot
          back={
            <Button
              variant="ghost"
              onPress={onBack}
              leadingIcon={<ArrowLeftIcon />}
            >
              Back to sign in
            </Button>
          }
          next={
            <Button
              variant="ember"
              onPress={onBack}
              trailingIcon={<ArrowRightIcon />}
            >
              Return to sign in
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
        Forgot your <em>password?</em>
      </AuthDisplay>
      <AuthLede>
        Enter your work email and we&rsquo;ll send a reset link.
      </AuthLede>

      <div className="cg-fade-up cg-fade-up-2 mt-s-8 flex flex-col gap-s-3">
        {error ? <InlineAlert>{error}</InlineAlert> : null}

        <FormField
          tone="auth"
          label={
            <span className="inline-flex items-center gap-[6px]">
              <MailIcon /> Email
            </span>
          }
          htmlFor="auth-forgot-email"
          error={emailErr ?? undefined}
        >
          <Input
            id="auth-forgot-email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            variant="auth"
            invalid={!!emailErr}
            value={v}
            onChange={(e) => set(e.currentTarget.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            autoFocus
          />
        </FormField>
      </div>

      <StepFoot
        back={
          <Button
            variant="ghost"
            onPress={onBack}
            leadingIcon={<ArrowLeftIcon />}
          >
            Back to sign in
          </Button>
        }
        next={
          <Button
            variant="ember"
            isLoading={isSubmitting}
            isDisabled={!v}
            onPress={submit}
            trailingIcon={!isSubmitting && <ArrowRightIcon />}
          >
            Send reset link
          </Button>
        }
      />
    </div>
  );
}
