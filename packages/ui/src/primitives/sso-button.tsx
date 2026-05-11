"use client";

import * as React from "react";
import { cva } from "class-variance-authority";

import { cn } from "../utils/cn";

/*
 * SSOButton — branded "Continue with Google / GitHub / Passkey" button.
 *
 * The bundled providers cover the auth-flow needs out of the box. For
 * a custom IdP, pass `provider="custom"` plus `icon` + the visible
 * `children` label.
 */

export const ssoButtonVariants = cva(
  "group inline-flex w-full items-center border transition-[background-color,border-color,color] duration-fast ease-out focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember disabled:opacity-40 disabled:cursor-not-allowed data-[pending=true]:cursor-wait h-[32px] gap-[8px] px-[10px] rounded-md border-hairline-strong bg-l-surface-raised font-sans text-[13px] font-medium text-l-ink hover:bg-l-surface-hover hover:border-l-border-strong"
);

export const ssoIconVariants = cva(
  "inline-flex shrink-0 items-center justify-center h-4 w-4 text-l-ink"
);

export const ssoLabelVariants = cva("flex-1 text-left");

export const ssoKbdVariants = cva(
  "inline-flex items-center justify-center h-[16px] min-w-[16px] rounded-xs bg-l-wash-3 px-[4px] font-sans text-[10px] font-medium text-l-ink-dim"
);

export const ssoSpinnerVariants = cva(
  "shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent h-3.5 w-3.5"
);

export type SSOProvider = "google" | "github" | "passkey" | "custom";

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
  <svg viewBox="0 0 16 16" width="18" height="18" fill="none" aria-hidden>
    <circle cx="5.5" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.3" />
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
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    "className" | "children" | "disabled"
  > {
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
  isDisabled?: boolean;
  onPress?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  ref?: React.Ref<HTMLButtonElement>;
  disabled?: boolean;
}

/**
 * Branded SSO button — built-in icon + label per provider
 * (Google, GitHub, passkey).
 */
export function SSOButton({
  provider,
  children,
  icon,
  kbd,
  isLoading,
  className,
  disabled,
  isDisabled,
  onClick,
  onPress,
  ref,
  type,
  ...rest
}: SSOButtonProps) {
  const pending = Boolean(isLoading);
  const label = children ?? PROVIDER_LABEL[provider];
  const glyph = icon ?? PROVIDER_GLYPH[provider];

  return (
    <button
      {...rest}
      ref={ref}
      type={type ?? "button"}
      data-provider={provider}
      data-pending={pending || undefined}
      disabled={disabled || isDisabled || pending}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onPress?.(event);
      }}
      className={cn(ssoButtonVariants(), className)}
    >
      <span className={ssoIconVariants()}>
        {pending ? <span className={ssoSpinnerVariants()} /> : glyph}
      </span>
      <span className={ssoLabelVariants()}>{label}</span>
      {kbd ? <span className={ssoKbdVariants()}>{kbd}</span> : null}
    </button>
  );
}
