"use client";

import * as React from "react";
import { cva } from "class-variance-authority";

import { cn } from "../utils/cn";

export const copyButtonVariants = cva(
  "inline-flex items-center justify-center border transition-colors duration-fast ease-out outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember h-[24px] w-[24px] rounded-md",
  {
    variants: {
      appearance: {
        icon: "",
        text: "h-auto w-auto border-0 bg-transparent px-[6px] py-[2px] font-mono text-[10px] uppercase tracking-[0.04em]",
      },
      copied: {
        true: "border-event-green/40 bg-[rgba(74,222,128,0.08)] text-event-green",
        false: "",
      },
    },
    compoundVariants: [
      {
        copied: false,
        className:
          "border-hairline-strong bg-l-surface-raised text-l-ink-lo hover:border-l-border-strong hover:text-l-ink",
      },
      {
        appearance: "text",
        copied: false,
        className:
          "h-auto w-auto border-transparent bg-transparent text-ink-dim hover:bg-surface-03 hover:text-ink-hi",
      },
      {
        appearance: "text",
        copied: true,
        className:
          "h-auto w-auto border-transparent bg-transparent text-event-green hover:bg-surface-03",
      },
    ],
    defaultVariants: {
      appearance: "icon",
      copied: false,
    },
  }
);

export interface CopyButtonProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    "className" | "children"
  > {
  text: string;
  /** Milliseconds the "copied" confirmation stays visible. */
  confirmFor?: number;
  /** Render as an icon button (default) or a compact text action. */
  appearance?: "icon" | "text";
  label?: string;
  copiedLabel?: string;
  className?: string;
  ref?: React.Ref<HTMLButtonElement>;
}

export function CopyButton({
  text,
  confirmFor = 2000,
  appearance = "icon",
  label = "Copy",
  copiedLabel = "Copied",
  className,
  onClick,
  ref,
  type,
  ...props
}: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false);
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
    <button
      {...props}
      ref={ref}
      type={type ?? "button"}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) void handleCopy();
      }}
      aria-label={copied ? "Copied" : "Copy to clipboard"}
      className={cn(copyButtonVariants({ appearance, copied }), className)}
    >
      {appearance === "text" ? (
        copied ? (
          copiedLabel
        ) : (
          label
        )
      ) : copied ? (
        <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
          <path
            d="M4.5 12.75l6 6 9-13.5"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
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
    </button>
  );
}
