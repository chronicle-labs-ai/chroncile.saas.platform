"use client";

import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../utils/cn";

/**
 * Button — Linear-inspired product chrome.
 *
 * Chronicle variants:
 *   primary    — ember signal CTA
 *   secondary  — wash + hairline border (default)
 *   ember      — alias for primary
 *   ghost      — label-only, hover surface wash
 *   icon       — square; `children` is the icon
 *   critical   — destructive red
 *
 * shadcn-compatible aliases (so paste-in upstream snippets just work):
 *   default     → secondary
 *   destructive → critical
 *   outline     → secondary
 *   link        → ghost (with link-y underline)
 */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-[6px] border transition-[background-color,color,border-color,transform] duration-fast ease-out outline-none whitespace-nowrap select-none rounded-md font-sans font-medium tracking-normal leading-none disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-1 focus-visible:ring-ember focus-visible:ring-offset-1 focus-visible:ring-offset-page active:translate-y-[1px] data-[pending=true]:cursor-wait",
  {
    variants: {
      variant: {
        primary:
          "border-transparent bg-ember text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_1px_1px_rgba(0,0,0,0.35)] hover:bg-[#e85520] active:bg-ember-deep",
        secondary:
          "bg-l-wash-3 border-hairline-strong text-l-ink hover:bg-l-wash-5 hover:border-l-border-strong",
        ember:
          "border-transparent bg-ember text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_1px_1px_rgba(0,0,0,0.35)] hover:bg-[#e85520] active:bg-ember-deep",
        ghost:
          "border-transparent bg-transparent text-l-ink-lo hover:bg-l-wash-3 hover:text-l-ink",
        icon:
          "border-transparent text-l-ink-lo hover:bg-l-wash-3 hover:text-l-ink p-0",
        critical:
          "border-transparent bg-event-red text-white hover:brightness-110",
        // shadcn aliases — same paint as their Chronicle equivalents.
        default:
          "bg-l-wash-3 border-hairline-strong text-l-ink hover:bg-l-wash-5 hover:border-l-border-strong",
        destructive:
          "border-transparent bg-event-red text-white hover:brightness-110",
        outline:
          "bg-transparent border-hairline-strong text-l-ink hover:bg-l-wash-3 hover:border-l-border-strong",
        link:
          "border-transparent bg-transparent text-ember underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-[28px] px-[10px] text-[12.5px]",
        md: "h-[32px] px-[12px] text-[13px]",
        lg: "h-[36px] px-[14px] text-[13px]",
      },
    },
    compoundVariants: [
      { variant: "icon", size: "sm", class: "w-[28px] px-0" },
      { variant: "icon", size: "md", class: "w-[32px] px-0" },
      { variant: "icon", size: "lg", class: "w-[36px] px-0" },
    ],
    defaultVariants: {
      variant: "secondary",
      size: "md",
    },
  }
);

export const buttonIconVariants = cva("shrink-0");
export const buttonSpinnerVariants = cva("h-4 w-4 shrink-0 animate-spin");

/**
 * Button variants. Canonical Chronicle set + shadcn aliases.
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
  | "default"
  | "destructive"
  | "outline"
  | "link";

export type ButtonSize = "sm" | "md" | "lg";

type ButtonVariantProps = VariantProps<typeof buttonVariants>;

export interface ButtonProps
  extends Omit<
      React.ButtonHTMLAttributes<HTMLButtonElement>,
      "className" | "children" | "disabled"
    >,
    ButtonVariantProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /**
   * Render the child element instead of the default `<button>`. Useful for
   * `<Button asChild><Link href="/x">Go</Link></Button>` patterns. Backed by
   * Radix `Slot` so all props (className, data-*, aria-*) are merged onto
   * the child.
   */
  asChild?: boolean;
  /** Loading state. Disables the button and swaps the leading icon for a spinner. */
  isLoading?: boolean;
  /** RAC-compatible pending alias. */
  isPending?: boolean;
  disabled?: boolean;
  /** RAC-compatible disabled alias. */
  isDisabled?: boolean;
  /** RAC-compatible press handler alias for existing call sites. */
  onPress?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  /** String className for the root. */
  className?: string;
  /** Optional per-slot overrides. Each is appended after the base slot class. */
  classNames?: { base?: string; icon?: string; spinner?: string };
  children?: React.ReactNode;
  ref?: React.Ref<HTMLButtonElement>;
}

export function Button({
  variant = "secondary",
  size = "md",
  asChild = false,
  isLoading,
  isPending,
  disabled,
  isDisabled,
  onClick,
  onPress,
  className,
  classNames,
  type,
  leadingIcon,
  trailingIcon,
  children,
  ref,
  ...rest
}: ButtonProps) {
  const pending = Boolean(isLoading ?? isPending);
  const disabledResolved = Boolean((disabled ?? isDisabled) || pending);

  if (asChild) {
    /*
     * Slot mode: the consumer's child element is the rendered node, and we
     * merge our props (className, data-*, aria-*) onto it. Leading/trailing
     * icons and the loading spinner are NOT injected — the consumer owns
     * the child's markup. Use the non-asChild path if you want those.
     */
    return (
      <Slot.Root
        {...(rest as React.ComponentProps<typeof Slot.Root>)}
        ref={ref as React.Ref<HTMLButtonElement>}
        data-disabled={disabledResolved || undefined}
        data-pending={pending || undefined}
        data-variant={variant}
        onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
          onClick?.(event);
          if (!event.defaultPrevented) onPress?.(event);
        }}
        className={cn(
          buttonVariants({ variant, size }),
          classNames?.base,
          className
        )}
      >
        {children as React.ReactElement}
      </Slot.Root>
    );
  }

  return (
    <button
      {...rest}
      ref={ref}
      type={type ?? "button"}
      disabled={disabledResolved}
      data-disabled={disabledResolved || undefined}
      data-pending={pending || undefined}
      data-variant={variant}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onPress?.(event);
      }}
      className={cn(
        buttonVariants({ variant, size }),
        classNames?.base,
        className
      )}
    >
      {pending ? (
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          className={cn(buttonSpinnerVariants(), classNames?.spinner)}
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
        <span className={cn(buttonIconVariants(), classNames?.icon)}>
          {leadingIcon}
        </span>
      ) : null}
      {children}
      {!pending && trailingIcon ? (
        <span className={cn(buttonIconVariants(), classNames?.icon)}>
          {trailingIcon}
        </span>
      ) : null}
    </button>
  );
}
