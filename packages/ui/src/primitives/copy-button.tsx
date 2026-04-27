"use client";

import * as React from "react";
import {
  Button as RACButton,
  type ButtonProps as RACButtonProps,
} from "react-aria-components/Button";

import { tv } from "../utils/tv";
import { composeTwRenderProps } from "../utils/compose";
import { useResolvedChromeDensity } from "../theme/chrome-style-context";

const copyButton = tv({
  base:
    "inline-flex items-center justify-center border " +
    "transition-colors duration-fast ease-out outline-none " +
    "data-[focus-visible=true]:outline data-[focus-visible=true]:outline-1 " +
    "data-[focus-visible=true]:outline-ember",
  variants: {
    density: {
      brand: "h-[30px] w-[30px] rounded-xs",
      compact: "h-[24px] w-[24px] rounded-l",
    },
    copied: {
      true: "border-event-green/40 bg-[rgba(74,222,128,0.08)] text-event-green",
      false: "",
    },
  },
  compoundVariants: [
    {
      density: "brand",
      copied: false,
      class:
        "border-hairline-strong bg-surface-02 text-ink-dim " +
        "data-[hovered=true]:border-ink-dim data-[hovered=true]:text-ink-hi",
    },
    {
      density: "compact",
      copied: false,
      class:
        "border-l-border bg-l-surface-raised text-l-ink-lo " +
        "data-[hovered=true]:border-l-border-strong data-[hovered=true]:text-l-ink",
    },
  ],
  defaultVariants: { density: "brand", copied: false },
});

export interface CopyButtonProps extends Omit<
  RACButtonProps,
  "className" | "children" | "onPress"
> {
  text: string;
  /** Milliseconds the "copied" confirmation stays visible. */
  confirmFor?: number;
  /** Force a density flavor. Defaults to whichever the surrounding
   * `ChromeStyleProvider` resolves to. */
  density?: "compact" | "brand";
  className?: string;
}

export function CopyButton({
  text,
  confirmFor = 2000,
  density: densityProp,
  className,
  ...props
}: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false);
  const density = useResolvedChromeDensity(densityProp);
  const timeoutRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(
        () => setCopied(false),
        confirmFor
      );
    } catch {
      // Clipboard API unavailable — silently noop. Caller can rely on the
      // button never flipping to "copied" to surface an error path.
    }
  }, [text, confirmFor]);

  return (
    <RACButton
      {...props}
      onPress={handleCopy}
      aria-label={copied ? "Copied" : "Copy to clipboard"}
      data-density={density}
      className={composeTwRenderProps(className, copyButton({ density, copied }))}
    >
      {copied ? (
        <svg viewBox="0 0 24 24" fill="none" className={density === "compact" ? "h-3.5 w-3.5" : "h-4 w-4"}>
          <path
            d="M4.5 12.75l6 6 9-13.5"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" className={density === "compact" ? "h-3.5 w-3.5" : "h-4 w-4"}>
          <rect
            x="8"
            y="8"
            width="12"
            height="12"
            rx="2"
            stroke="currentColor"
            strokeWidth={1.5}
          />
          <path
            d="M4 16V6a2 2 0 0 1 2-2h10"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        </svg>
      )}
    </RACButton>
  );
}
