"use client";

import * as React from "react";
import { Button } from "../primitives/button";
import { Eyebrow } from "../primitives/eyebrow";
import { FormField } from "../primitives/form-field";
import { Input } from "../primitives/input";
import { OrDivider } from "../primitives/or-divider";
import { SSOButton } from "../primitives/sso-button";
import {
  ArrowRightIcon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  MailIcon,
} from "../icons/glyphs";
import {
  AuthDisplay,
  AuthLede,
  InlineAlert,
  isValidEmail,
  StepFoot,
} from "./_internal";
import { DomainStrip } from "./domain-detect";
import type { DiscoverResult } from "./sign-up-email";

/**
 * SignIn — controlled sign-in screen.
 *
 * The parent owns submission + the SSO redirects; this component just
 * renders the form, drives local UI (show/hide password, email regex),
 * and fires callbacks. Render inside
 * `<AuthShell topbar={{ cta: <CreateAccountLink/> }}>`.
 */

export interface SignInValue {
  email: string;
  password: string;
}

export interface SignInProps {
  /** Controlled email + password state. */
  value?: SignInValue;
  /** Default seed when uncontrolled. */
  defaultValue?: Partial<SignInValue>;
  /** Fires on every keystroke. */
  onChange?: (next: SignInValue) => void;
  /** Submit handler — receives the current value. */
  onSubmit?: (value: SignInValue) => void;
  /** Forgot-password link click. */
  onForgot?: () => void;
  /** Footer create-account link click. */
  onSignUp?: () => void;
  /** SSO provider click. The parent kicks off the OAuth redirect.
   *  `"saml"` is the dedicated SAML/SSO button that appears on D.2. */
  onSSO?: (provider: "google" | "github" | "passkey" | "saml") => void;
  /** Top-level error banner (e.g. "credentials didn't match"). */
  error?: string | null;
  /** Disable + spinner for the primary CTA. */
  isSubmitting?: boolean;
  /** When loading, which SSO provider is the source — drives its spinner. */
  ssoLoading?: "google" | "github" | "passkey" | "saml" | null;
  /** Headline override. Default "Welcome back." */
  headline?: React.ReactNode;
  /** Lede override. */
  lede?: React.ReactNode;
  /** Hide the SSO stack (rare — useful when only credentials are configured). */
  hideSSO?: boolean;
  /**
   * Latest `/api/auth/discover` result for the typed email. Drives the
   * D.1 / D.2 sub-states:
   *   • `null` / `kind in {free, existing}` → normal credentials flow.
   *   • `kind === "sso_required"` → password field is hidden, replaced by
   *     a single `Sign in with <orgName> SSO` button + tone="sso" strip.
   */
  discover?: DiscoverResult | null;
  /** Whether the discover endpoint is mid-flight. */
  isDiscovering?: boolean;
}

/**
 * Sign-in screen — credentials + SSO + forgot link. Controlled or
 * uncontrolled (`value` / `defaultValue`). Render inside
 * `<AuthShell topbar={{ cta: <CreateAccountLink/> }}>`.
 */
export function SignIn({
  value,
  defaultValue,
  onChange,
  onSubmit,
  onForgot,
  onSignUp,
  onSSO,
  error = null,
  isSubmitting = false,
  ssoLoading = null,
  headline,
  lede,
  hideSSO = false,
  discover = null,
  isDiscovering = false,
}: SignInProps) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = React.useState<SignInValue>({
    email: defaultValue?.email ?? "",
    password: defaultValue?.password ?? "",
  });
  const v = isControlled ? value! : internal;
  const set = (next: SignInValue) => {
    if (!isControlled) setInternal(next);
    onChange?.(next);
  };
  const setField = <K extends keyof SignInValue>(k: K, val: SignInValue[K]) =>
    set({ ...v, [k]: val });

  const [showPw, setShowPw] = React.useState(false);
  const [emailErr, setEmailErr] = React.useState<string | null>(null);
  const [pwErr, setPwErr] = React.useState<string | null>(null);

  const submit = () => {
    let bad = false;
    setEmailErr(null);
    setPwErr(null);
    if (!v.email) {
      setEmailErr("Enter your work email");
      bad = true;
    } else if (!isValidEmail(v.email)) {
      setEmailErr("That email doesn't look right");
      bad = true;
    }
    if (!v.password) {
      setPwErr("Enter your password");
      bad = true;
    }
    if (bad) return;
    onSubmit?.(v);
  };

  const isSSORequired = discover?.kind === "sso_required";
  const orgName = discover?.orgName ?? "your workspace";
  const ssoProvider = discover?.ssoProvider ?? "your IdP";

  return (
    <div className="flex flex-col">
      <Eyebrow className="inline-flex items-center gap-s-2">
        <b>SIGN IN</b> · CHRONICLE
      </Eyebrow>
      <AuthDisplay>
        {headline ?? (
          <>
            Welcome <em>back.</em>
          </>
        )}
      </AuthDisplay>
      <AuthLede>{lede ?? "Pick up where the stream left off."}</AuthLede>

      <div className="cg-fade-up cg-fade-up-2 mt-s-8 flex flex-col gap-s-3">
        {error ? <InlineAlert>{error}</InlineAlert> : null}

        {hideSSO || isSSORequired ? null : (
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
              <SSOButton
                provider="passkey"
                onPress={() => onSSO?.("passkey")}
                isLoading={ssoLoading === "passkey"}
                isDisabled={
                  isSubmitting || (!!ssoLoading && ssoLoading !== "passkey")
                }
              />
            </div>
            <OrDivider />
          </>
        )}

        <FormField
          tone="auth"
          label={
            <span className="inline-flex items-center gap-[6px]">
              <MailIcon /> Email
            </span>
          }
          htmlFor="auth-signin-email"
          error={emailErr ?? undefined}
        >
          <Input
            id="auth-signin-email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            variant="auth"
            invalid={!!emailErr}
            value={v.email}
            onChange={(e) => setField("email", e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            autoFocus
          />
        </FormField>

        {/* Discover-driven strip — surfaces the D.1 / D.2 sub-states. */}
        {v.email ? (
          isDiscovering ? (
            <DomainStrip tone="neutral" label="Checking your workspace…" />
          ) : isSSORequired ? (
            <DomainStrip
              tone="sso"
              orgName={discover.orgName}
              label={
                <>
                  <b className="text-ink-hi">{orgName}</b> uses single sign-on
                  through <b className="text-ink-hi">{ssoProvider}</b>.
                </>
              }
            />
          ) : null
        ) : null}

        {/* Password / SSO dispatch — hides the password field on D.2. */}
        {isSSORequired ? (
          <div className="flex flex-col gap-s-2">
            <SSOButton
              provider="custom"
              icon={<LockIcon size={16} />}
              onPress={() => onSSO?.("saml")}
              isLoading={ssoLoading === "saml"}
              isDisabled={
                isSubmitting || (!!ssoLoading && ssoLoading !== "saml")
              }
            >{`Sign in with ${orgName} SSO`}</SSOButton>
            <span className="font-mono text-mono-sm text-ink-dim">
              Password sign-in disabled by your admin
            </span>
          </div>
        ) : (
          <FormField
            tone="auth"
            label={
              <span className="flex items-center justify-between">
                <span className="inline-flex items-center gap-[6px]">
                  <LockIcon /> Password
                </span>
                <button
                  type="button"
                  onClick={onForgot}
                  className="font-mono text-mono-sm normal-case tracking-mono text-ink-dim hover:text-ink-hi transition-colors"
                >
                  Forgot?
                </button>
              </span>
            }
            htmlFor="auth-signin-password"
            error={pwErr ?? undefined}
          >
            <div className="relative">
              <Input
                id="auth-signin-password"
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••••"
                variant="auth"
                invalid={!!pwErr}
                value={v.password}
                onChange={(e) => setField("password", e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
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
        )}
      </div>

      <StepFoot
        back={
          <Button variant="ghost" onPress={onSignUp}>
            New here? Create an account
          </Button>
        }
        next={
          isSSORequired ? null : (
            <Button
              variant="ember"
              isLoading={isSubmitting}
              onPress={submit}
              trailingIcon={!isSubmitting && <ArrowRightIcon />}
            >
              {isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
          )
        }
      />
    </div>
  );
}
