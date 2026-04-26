"use client";

import * as React from "react";
import {
  Button as RACButton,
  type ButtonProps as RACButtonProps,
} from "react-aria-components/Button";
import { tv } from "../utils/tv";
import { composeTwRenderProps } from "../utils/compose";

/*
 * SSOButton — branded "Continue with Google / GitHub / Passkey" button.
 *
 * The bundled providers cover the auth-flow needs out of the box. For
 * a custom IdP, pass `provider="custom"` plus `icon` + the visible
 * `children` label.
 */

export type SSOProvider = "google" | "github" | "passkey" | "custom";

const sso = tv({
  slots: {
    base:
      "group inline-flex w-full h-[44px] items-center gap-s-3 px-s-3 " +
      "rounded-sm border border-hairline-strong bg-surface-01 " +
      "font-sans text-[13.5px] font-medium text-ink-hi " +
      "transition-[background-color,border-color,color] duration-fast ease-out " +
      "data-[hovered=true]:bg-surface-02 data-[hovered=true]:border-ink-dim " +
      "data-[focus-visible=true]:outline data-[focus-visible=true]:outline-1 " +
      "data-[focus-visible=true]:outline-ember " +
      "data-[disabled=true]:opacity-40 data-[disabled=true]:cursor-not-allowed " +
      "data-[pending=true]:cursor-wait",
    icon:
      "inline-flex h-5 w-5 shrink-0 items-center justify-center text-ink",
    label: "flex-1 text-left",
    kbd:
      "inline-flex h-[18px] min-w-[18px] items-center justify-center " +
      "rounded-l-sm bg-surface-03 px-[5px] font-mono text-mono-sm " +
      "text-ink-dim",
    spinner:
      "h-4 w-4 shrink-0 animate-spin rounded-full border-2 " +
      "border-current border-t-transparent",
  },
});

const GoogleGlyph = () => (
  <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden>
    <path
      fill="#fff"
      d="M15.5 8.18c0-.55-.05-1.07-.14-1.57H8v3.07h4.21c-.18.95-.74 1.76-1.57 2.3v1.92h2.54c1.49-1.37 2.32-3.4 2.32-5.72z"
    />
    <path
      fill="#4ade80"
      d="M8 16c2.12 0 3.9-.7 5.18-1.9l-2.54-1.97c-.7.47-1.6.75-2.64.75-2.05 0-3.78-1.38-4.4-3.24H1v2.03A7.99 7.99 0 0 0 8 16z"
    />
    <path
      fill="#fbbf24"
      d="M3.6 9.64A4.8 4.8 0 0 1 3.34 8c0-.57.1-1.13.26-1.64V4.33H1A8 8 0 0 0 0 8c0 1.29.31 2.51.86 3.66l2.74-2.02z"
    />
    <path
      fill="#ef4444"
      d="M8 3.16c1.16 0 2.2.4 3.02 1.18l2.26-2.26C11.9.79 10.13 0 8 0a8 8 0 0 0-7 4.34l2.6 2.02C4.22 4.55 5.95 3.16 8 3.16z"
    />
  </svg>
);

const GithubGlyph = () => (
  <svg
    viewBox="0 0 16 16"
    width="18"
    height="18"
    fill="currentColor"
    aria-hidden
  >
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

const PasskeyGlyph = () => (
  <svg
    viewBox="0 0 16 16"
    width="18"
    height="18"
    fill="none"
    aria-hidden
  >
    <circle
      cx="5.5"
      cy="5.5"
      r="2.5"
      stroke="currentColor"
      strokeWidth="1.3"
    />
    <path
      d="M7.5 7.2l5.6 5.6M11.4 11.1l1.6-1M9.9 9.6L11.4 8.3"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
    />
  </svg>
);

const PROVIDER_LABEL: Record<SSOProvider, string> = {
  google: "Continue with Google",
  github: "Continue with GitHub",
  passkey: "Sign in with passkey",
  custom: "Continue",
};

const PROVIDER_GLYPH: Record<SSOProvider, React.ReactNode> = {
  google: <GoogleGlyph />,
  github: <GithubGlyph />,
  passkey: <PasskeyGlyph />,
  custom: null,
};

export interface SSOButtonProps
  extends Omit<RACButtonProps, "className" | "children"> {
  /** SSO provider preset. Use `"custom"` and pass `icon` + `children`. */
  provider: SSOProvider;
  /** Override the default label for the provider. */
  children?: React.ReactNode;
  /** Optional custom icon (required when provider is `"custom"`). */
  icon?: React.ReactNode;
  /** Optional keyboard shortcut hint at the end of the row. */
  kbd?: React.ReactNode;
  /** Loading state — disables and swaps the icon for a spinner. */
  isLoading?: boolean;
  className?: string;
}

/**
 * Branded SSO button — built-in icon + label per provider
 * (Google, GitHub, passkey). Wraps `<Button density="brand">` so
 * size / variant tokens line up with the rest of the auth flow.
 */
export function SSOButton({
  provider,
  children,
  icon,
  kbd,
  isLoading,
  isPending,
  className,
  isDisabled,
  ...rest
}: SSOButtonProps) {
  const slots = sso();
  const pending = isLoading ?? isPending;
  const label = children ?? PROVIDER_LABEL[provider];
  const glyph = icon ?? PROVIDER_GLYPH[provider];

  return (
    <RACButton
      type="button"
      data-provider={provider}
      isPending={pending}
      isDisabled={isDisabled || pending}
      className={composeTwRenderProps(undefined, slots.base({ className }))}
      {...rest}
    >
      <span className={slots.icon()}>
        {pending ? <span className={slots.spinner()} /> : glyph}
      </span>
      <span className={slots.label()}>{label}</span>
      {kbd ? <span className={slots.kbd()}>{kbd}</span> : null}
    </RACButton>
  );
}
