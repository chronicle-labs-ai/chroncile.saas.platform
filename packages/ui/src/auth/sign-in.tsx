"use client";

import * as React from "react";
import { Button } from "../primitives/button";
import { useIsCoarsePointer } from "../utils/use-is-coarse-pointer";
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
  /** Top-level error banner (e.g. "credentials didn't match"). Accepts a
   *  string or a JSX node — pass JSX when you need inline links / buttons
   *  inside the alert (e.g. "click here" to set a password). */
  error?: React.ReactNode | null;
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

  /*
   * Auto-focus is desktop-only: on touch devices it pops the
   * software keyboard before the user has read the page, hiding
   * the welcome lede and the SSO buttons. `useIsCoarsePointer`
   * starts `false` on the server so the SSR markup matches the
   * client's first render — the effect flips it after mount on
   * touch devices, and React quietly drops the `autoFocus` prop
   * (which only fires on the very first mount) on those.
   */
  const isCoarse = useIsCoarsePointer();

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
      <Eyebrow className="inline-flex items-center gap-s-2 font-sans">
        <b>SIGN IN</b> · CHRONICLE LABS
      </Eyebrow>
      <AuthDisplay>
        {headline ?? (
          <>
            Welcome <em>back.</em>
          </>
        )}
      </AuthDisplay>
      <AuthLede>{lede ?? "Pick up where the stream left off."}</AuthLede>

      {/*
       * Wrapping the credential pair in a `<form>` gives us native
       * Enter-to-submit (no per-input `onKeyDown` bookkeeping),
       * predictable browser autofill, and password-manager hints.
       * The submit button lives in the StepFoot below and references
       * this form by id so the visual layout (sticky footer rail)
       * stays intact.
       */}
      <form
        id="auth-signin-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        noValidate
        className="cg-fade-up cg-fade-up-2 mt-s-8 flex flex-col gap-s-3"
      >
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
            inputMode="email"
            autoComplete="email"
            spellCheck={false}
            autoCapitalize="off"
            placeholder="you@company.com"
            variant="auth"
            invalid={!!emailErr}
            value={v.email}
            onChange={(e) => setField("email", e.currentTarget.value)}
            autoFocus={!isCoarse}
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
                className="pr-[44px]"
              />
              {/*
               * Visual size stays at the icon's natural 16-18px so
               * the trigger doesn't dominate the field, but the hit
               * area expands to ≥36px (and ≥44px on coarse pointers)
               * via padding so users with imprecise input — fingers,
               * stylus — can hit it reliably. Per Emil's tap-target
               * rule and WCAG 2.5.5 (target size).
               */}
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                aria-label={showPw ? "Hide password" : "Show password"}
                aria-pressed={showPw}
                className="absolute right-[2px] top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-ink-dim transition-colors duration-fast ease-out hover:text-ink-hi focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-ember [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11 touch-manipulation"
              >
                {showPw ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </FormField>
        )}
      </form>

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
              type="submit"
              form="auth-signin-form"
              isLoading={isSubmitting}
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
