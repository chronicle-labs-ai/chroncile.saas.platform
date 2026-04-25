"use client";

import * as React from "react";
import {
  Button as RACButton,
  type ButtonProps as RACButtonProps,
} from "react-aria-components/Button";

import { tv, type VariantProps } from "../utils/tv";
import { composeTwRenderProps } from "../utils/compose";

/**
 * Button — two density flavors share one component:
 *
 *   density="compact" (default, Linear-inspired product chrome)
 *     primary   — ember signal CTA
 *     secondary — wash + hairline border
 *     ghost     — label-only, hover surface wash
 *     icon      — square; `children` is the icon
 *     critical  — destructive red
 *
 *   density="brand" (mono-uppercase, marketing/decks)
 *     primary   — high-contrast ink (white-on-black in dark, black-on-bone in light)
 *     secondary — hairline ghost
 *     ember     — brand orange CTA
 *     ghost     — label-only, hover surface
 *     critical  — destructive red
 *
 * Legacy variant names (`data`, `nominal`, `ember` outside brand) keep
 * compiling: they map to the closest Linear-density slot. Existing
 * call-sites stay visually unchanged inside `density="brand"` — the
 * compact density only kicks in when explicitly opted into (or when
 * an app passes `density="compact"` at the surface level).
 */
/**
 * Button variants. The first six are the canonical set:
 *   primary, secondary, ember, ghost, icon, critical
 *
 * `data` and `nominal` are kept for back-compat with older call-sites
 * (they map onto event-color CTAs). Prefer `primary` (compact density)
 * or `ember` (brand density) for the signal CTA going forward.
 *
 * @public
 */
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ember"
  | "ghost"
  | "icon"
  | "critical"
  /** @deprecated Use `primary` (compact) or a custom event-colored Badge. */
  | "data"
  /** @deprecated Use `primary` (compact) or a custom event-colored Badge. */
  | "nominal";

export type ButtonSize = "sm" | "md" | "lg";
export type ButtonDensity = "compact" | "brand";

const button = tv({
  slots: {
    base:
      "inline-flex items-center justify-center gap-[6px] " +
      "border transition-[background-color,color,border-color,transform] " +
      "duration-fast ease-out outline-none whitespace-nowrap select-none " +
      "data-[focus-visible=true]:ring-1 data-[focus-visible=true]:ring-ember " +
      "data-[focus-visible=true]:ring-offset-1 data-[focus-visible=true]:ring-offset-page " +
      "data-[pressed=true]:translate-y-[1px] " +
      "data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-40 " +
      "data-[pending=true]:cursor-wait",
    icon: "shrink-0",
    spinner: "h-4 w-4 shrink-0 animate-spin",
  },
  variants: {
    density: {
      compact:
        "rounded-l font-sans font-medium tracking-normal leading-none",
      brand:
        "rounded-xs font-mono uppercase tracking-tactical",
    },
    variant: {
      // Filled in per-density via compoundVariants below.
      primary: "border-transparent",
      secondary: "",
      ember: "border-transparent",
      ghost: "border-transparent bg-transparent",
      icon: "border-transparent",
      critical: "border-transparent",
      data: "border-transparent",
      nominal: "border-transparent",
    },
    size: {
      sm: "",
      md: "",
      lg: "",
    },
  },
  compoundVariants: [
    // ── Compact / Linear density ──────────────────────────────────
    {
      density: "compact",
      size: "sm",
      class: { base: "h-[28px] px-[10px] text-[12.5px]" },
    },
    {
      density: "compact",
      size: "md",
      class: { base: "h-[32px] px-[12px] text-[13px]" },
    },
    {
      density: "compact",
      size: "lg",
      class: { base: "h-[36px] px-[14px] text-[13px]" },
    },
    // Variants
    {
      density: "compact",
      variant: "primary",
      class: {
        base:
          "bg-ember text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_1px_1px_rgba(0,0,0,0.35)] " +
          "data-[hovered=true]:bg-[#e85520] data-[pressed=true]:bg-ember-deep",
      },
    },
    {
      density: "compact",
      variant: "secondary",
      class: {
        base:
          "bg-l-wash-3 border-l-border text-l-ink " +
          "data-[hovered=true]:bg-l-wash-5 data-[hovered=true]:border-l-border-strong",
      },
    },
    {
      density: "compact",
      variant: "ghost",
      class: {
        base:
          "text-l-ink-lo data-[hovered=true]:bg-l-wash-3 data-[hovered=true]:text-l-ink",
      },
    },
    {
      density: "compact",
      variant: "icon",
      class: {
        base:
          "text-l-ink-lo data-[hovered=true]:bg-l-wash-3 data-[hovered=true]:text-l-ink p-0",
      },
    },
    {
      density: "compact",
      variant: "critical",
      class: {
        base:
          "bg-event-red text-white data-[hovered=true]:brightness-110",
      },
    },
    {
      // Compact has no dedicated `ember` variant — primary IS ember in
      // this density. Map to primary.
      density: "compact",
      variant: "ember",
      class: {
        base:
          "bg-ember text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_1px_1px_rgba(0,0,0,0.35)] " +
          "data-[hovered=true]:bg-[#e85520] data-[pressed=true]:bg-ember-deep",
      },
    },
    {
      density: "compact",
      variant: "data",
      class: {
        base: "bg-event-teal text-black data-[hovered=true]:brightness-110",
      },
    },
    {
      density: "compact",
      variant: "nominal",
      class: {
        base: "bg-event-green text-black data-[hovered=true]:brightness-110",
      },
    },
    // Square icon override — keep square width on each size
    {
      density: "compact",
      variant: "icon",
      size: "sm",
      class: { base: "w-[28px] px-0" },
    },
    {
      density: "compact",
      variant: "icon",
      size: "md",
      class: { base: "w-[32px] px-0" },
    },
    {
      density: "compact",
      variant: "icon",
      size: "lg",
      class: { base: "w-[36px] px-0" },
    },

    // ── Brand / editorial density ─────────────────────────────────
    {
      density: "brand",
      size: "sm",
      class: { base: "h-[28px] px-s-3 text-mono-sm" },
    },
    {
      density: "brand",
      size: "md",
      class: { base: "h-[36px] px-s-4 text-mono" },
    },
    {
      density: "brand",
      size: "lg",
      class: { base: "h-[44px] px-s-5 text-mono-lg" },
    },
    {
      density: "brand",
      variant: "primary",
      class: {
        base:
          "border-transparent text-[color:var(--c-btn-invert-fg)] " +
          "[background:var(--c-btn-invert-bg)] " +
          "data-[hovered=true]:[background:var(--c-ink-hi)]",
      },
    },
    {
      density: "brand",
      variant: "secondary",
      class: {
        base:
          "border-hairline-strong bg-transparent text-ink-lo " +
          "data-[hovered=true]:text-ink-hi data-[hovered=true]:border-ink-dim",
      },
    },
    {
      density: "brand",
      variant: "ember",
      class: {
        base:
          "border-transparent bg-ember text-white data-[hovered=true]:bg-ember-deep",
      },
    },
    {
      density: "brand",
      variant: "ghost",
      class: {
        base:
          "border-transparent bg-transparent text-ink-lo " +
          "data-[hovered=true]:bg-surface-03 data-[hovered=true]:text-ink-hi",
      },
    },
    {
      density: "brand",
      variant: "icon",
      // Brand has no dedicated icon variant — fall back to ghost styling,
      // square per size below.
      class: {
        base:
          "border-transparent bg-transparent text-ink-lo " +
          "data-[hovered=true]:bg-surface-03 data-[hovered=true]:text-ink-hi p-0",
      },
    },
    {
      density: "brand",
      variant: "critical",
      class: {
        base:
          "border-transparent bg-event-red text-white data-[hovered=true]:brightness-110",
      },
    },
    {
      density: "brand",
      variant: "data",
      class: {
        base:
          "border-transparent bg-event-teal text-black data-[hovered=true]:brightness-110",
      },
    },
    {
      density: "brand",
      variant: "nominal",
      class: {
        base:
          "border-transparent bg-event-green text-black data-[hovered=true]:brightness-110",
      },
    },
    {
      density: "brand",
      variant: "icon",
      size: "sm",
      class: { base: "w-[28px] px-0" },
    },
    {
      density: "brand",
      variant: "icon",
      size: "md",
      class: { base: "w-[36px] px-0" },
    },
    {
      density: "brand",
      variant: "icon",
      size: "lg",
      class: { base: "w-[44px] px-0" },
    },
  ],
  defaultVariants: {
    density: "compact",
    variant: "secondary",
    size: "md",
  },
});

type ButtonVariantProps = VariantProps<typeof button>;

export interface ButtonProps
  extends Omit<RACButtonProps, "className" | "children">,
    ButtonVariantProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /**
   * Density flavor.
   *   `"compact"` (default) — Linear-inspired product chrome.
   *   `"brand"` — mono-uppercase editorial buttons; reach for this on
   *               marketing pages, decks, and brand surfaces.
   */
  density?: ButtonDensity;
  /** Alias for RAC's `isPending`. Both work; `isLoading` wins if both passed. */
  isLoading?: boolean;
  /** Alias for RAC's `isDisabled`. Both work; `disabled` wins if both passed. */
  disabled?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  /** String className for the root. */
  className?: string;
  /** Optional per-slot overrides. Each is appended after the base slot class. */
  classNames?: { base?: string; icon?: string; spinner?: string };
  children?: React.ReactNode;
}

export function Button({
  variant = "secondary",
  size = "md",
  density = "compact",
  isLoading,
  isPending,
  disabled,
  isDisabled,
  className,
  classNames,
  type,
  leadingIcon,
  trailingIcon,
  children,
  ...rest
}: ButtonProps) {
  const slots = button({ variant, size, density });
  const pending = isLoading ?? isPending;
  const disabledResolved = disabled ?? isDisabled;

  return (
    <RACButton
      {...rest}
      type={type ?? "button"}
      isDisabled={disabledResolved}
      isPending={pending}
      data-variant={variant}
      data-density={density}
      className={composeTwRenderProps(
        classNames?.base,
        slots.base({ className }),
      )}
    >
      {pending ? (
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          className={slots.spinner({ className: classNames?.spinner })}
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="2"
            className="opacity-25"
          />
          <path
            d="M4 12a8 8 0 018-8"
            stroke="currentColor"
            strokeWidth="2"
            className="opacity-75"
          />
        </svg>
      ) : leadingIcon ? (
        <span className={slots.icon({ className: classNames?.icon })}>
          {leadingIcon}
        </span>
      ) : null}
      {children}
      {!pending && trailingIcon ? (
        <span className={slots.icon({ className: classNames?.icon })}>
          {trailingIcon}
        </span>
      ) : null}
    </RACButton>
  );
}
