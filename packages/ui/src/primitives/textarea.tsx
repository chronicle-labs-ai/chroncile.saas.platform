"use client";

import * as React from "react";
import {
  TextArea as RACTextArea,
  type TextAreaProps as RACTextAreaProps,
} from "react-aria-components/TextArea";

import { tv, type VariantProps } from "../utils/tv";
import { composeTwRenderProps } from "../utils/compose";
import { useResolvedChromeDensity } from "../theme/chrome-style-context";

export type TextareaDensity = "compact" | "brand";

const textarea = tv({
  base:
    "min-h-[120px] w-full resize-y border outline-none " +
    "transition-[border-color,box-shadow,background-color] duration-fast ease-out " +
    "data-[invalid=true]:border-event-red " +
    "data-[focused=true]:data-[invalid=true]:border-event-red " +
    "data-[disabled=true]:opacity-50 data-[disabled=true]:cursor-not-allowed",
  variants: {
    density: {
      compact:
        "rounded-l border-l-border bg-l-surface-input px-[10px] py-[6px] " +
        "font-sans text-[13px] leading-snug text-l-ink placeholder:text-l-ink-dim " +
        "data-[hovered=true]:border-l-border-strong " +
        "data-[focused=true]:border-[rgba(216,67,10,0.5)] " +
        "data-[focused=true]:shadow-[0_0_0_3px_rgba(216,67,10,0.12)]",
      brand:
        "rounded-sm border-hairline-strong bg-surface-00 px-s-3 py-s-2 " +
        "font-mono text-mono-lg text-ink placeholder:text-ink-faint " +
        "data-[hovered=true]:border-ink-dim " +
        "data-[focused=true]:border-ember",
    },
    variant: {
      default: "",
      auth:
        "bg-transparent border-hairline-strong text-ink-hi " +
        "data-[focused=true]:border-ink-hi",
    },
    invalid: { true: "border-event-red data-[focused=true]:border-event-red" },
  },
  defaultVariants: { density: "brand", variant: "default" },
});

type TextareaVariantProps = VariantProps<typeof textarea>;

export interface TextareaProps
  extends Omit<RACTextAreaProps, "className">, TextareaVariantProps {
  className?: string;
  density?: TextareaDensity;
  invalid?: boolean;
  variant?: "default" | "auth";
}

export function Textarea({
  invalid = false,
  variant = "default",
  density: densityProp,
  className,
  ref,
  ...props
}: TextareaProps & { ref?: React.Ref<HTMLTextAreaElement> }) {
  const density = useResolvedChromeDensity(densityProp);
  return (
    <RACTextArea
      {...props}
      ref={ref}
      data-density={density}
      className={composeTwRenderProps(
        undefined,
        textarea({ density, variant, invalid, className })
      )}
    />
  );
}
