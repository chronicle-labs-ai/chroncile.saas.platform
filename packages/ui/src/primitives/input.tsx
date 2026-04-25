"use client";

import * as React from "react";
import {
  Input as RACInput,
  type InputProps as RACInputProps,
} from "react-aria-components/Input";

import { tv, type VariantProps } from "../utils/tv";
import { composeTwRenderProps } from "../utils/compose";

/**
 * Input is a direct swap for `<input>` — RAC's `<Input>` subcomponent
 * accepts every native input attribute and additionally emits
 * `data-hovered`, `data-focused`, `data-focus-visible`, `data-invalid`,
 * `data-disabled` so we target all states from CSS without consumer churn.
 *
 * When this is the child of a RAC `<TextField>`, RAC auto-wires
 * `aria-describedby` to the sibling `<Text slot="description">` and
 * `aria-errormessage` to `<FieldError>`. Outside a TextField it behaves as
 * a plain input.
 */

/**
 * Two density flavors:
 *   `"compact"` (default) — Linear-density 28 px h, 13 px sans, ember
 *                            focus halo. Use on product surfaces.
 *   `"brand"`             — 36 px-ish mono input on the brand surface
 *                            stack (`bg-surface-00`). Reach for this on
 *                            marketing forms / auth.
 */
export type InputDensity = "compact" | "brand";

const input = tv({
  base:
    "w-full border outline-none " +
    "transition-[border-color,box-shadow,background-color] duration-fast ease-out " +
    "data-[disabled=true]:opacity-50 data-[disabled=true]:cursor-not-allowed",
  variants: {
    density: {
      compact:
        "h-[28px] rounded-l border-l-border bg-l-surface-input px-[10px] " +
        "font-sans text-[13px] text-l-ink placeholder:text-l-ink-dim " +
        "data-[hovered=true]:border-l-border-strong " +
        "data-[focused=true]:border-[rgba(216,67,10,0.5)] " +
        "data-[focused=true]:shadow-[0_0_0_3px_rgba(216,67,10,0.12)] " +
        "data-[invalid=true]:border-event-red " +
        "data-[focused=true]:data-[invalid=true]:border-event-red",
      brand:
        "rounded-sm border-hairline-strong bg-surface-00 px-s-3 py-s-2 " +
        "font-mono text-mono-lg text-ink placeholder:text-ink-faint " +
        "data-[hovered=true]:border-ink-dim " +
        "data-[focused=true]:border-ember " +
        "data-[invalid=true]:border-event-red " +
        "data-[focused=true]:data-[invalid=true]:border-event-red",
    },
    variant: {
      default: "",
      auth:
        "bg-transparent border-hairline-strong text-ink-hi " +
        "data-[focused=true]:border-ink-hi",
    },
    search: { true: "pl-[36px]" },
    invalid: { true: "border-event-red data-[focused=true]:border-event-red" },
  },
  defaultVariants: { density: "compact", variant: "default" },
});

type InputVariantProps = VariantProps<typeof input>;

export interface InputProps
  extends Omit<RACInputProps, "className">,
    InputVariantProps {
  className?: string;
  density?: InputDensity;
  /** Render a leading search glyph and adjust padding. */
  search?: boolean;
  invalid?: boolean;
  variant?: "default" | "auth";
  /** Wrapper className when `search` is true. */
  wrapperClassName?: string;
}

export function Input({
  search = false,
  invalid = false,
  density = "compact",
  variant = "default",
  className,
  wrapperClassName,
  ref,
  ...props
}: InputProps & { ref?: React.Ref<HTMLInputElement> }) {
  const field = (
    <RACInput
      {...props}
      ref={ref}
      data-density={density}
      className={composeTwRenderProps(
        undefined,
        input({ density, variant, search, invalid, className }),
      )}
    />
  );

  if (!search) return field;

  return (
    <div className={`relative ${wrapperClassName ?? ""}`}>
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className={
          density === "compact"
            ? "pointer-events-none absolute left-[10px] top-1/2 h-[14px] w-[14px] -translate-y-1/2 text-l-ink-dim"
            : "pointer-events-none absolute left-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-dim"
        }
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
        />
      </svg>
      {field}
    </div>
  );
}
