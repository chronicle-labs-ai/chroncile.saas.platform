"use client";

/*
 * CopyButton — clipboard primitive with crossfaded state transitions.
 *
 * Emil-style polish, distilled into one small primitive:
 *
 *   • Press feedback. `active:scale-[0.94]` gives the click an
 *     instant "I heard you" beat. A tighter target gets a deeper
 *     scale than a larger one, which is why this is more emphatic
 *     than `<Button>`'s 0.97 — fingers on a 24×24 want bigger feel.
 *
 *   • Zero layout shift. The two icons (copy ↔ check) and the two
 *     labels (Copy ↔ Copied) are stacked in a single CSS-grid cell,
 *     so the box always sizes to the *larger* of the pair. When the
 *     state flips, only opacity / transform / filter change — width
 *     is locked from first paint. `tabular-nums` stabilises any
 *     digit-bearing label.
 *
 *   • Crossfade with blur. A pure opacity crossfade reveals both
 *     silhouettes mid-transition and reads as "two icons stacked".
 *     A 0.5px `filter: blur(…)` on the outgoing layer + a 1.5%
 *     scale-down tricks the eye into perceiving a single morph
 *     instead of two distinct elements swapping.
 *
 *   • Hit area without inflation. Visual remains 24×24 (icon) or
 *     label-sized (text), but a transparent `::before` pseudo
 *     extends the hit region toward 44×44 so the button is
 *     comfortable on touch without changing the surrounding layout.
 *
 *   • Specific transitions. Never `transition: all`. Each element
 *     animates exactly the properties that should move; everything
 *     else is instant.
 *
 *   • Reduced motion. `motion-reduce:` strips transform / filter /
 *     scale animation, leaving opacity + colour (the parts that aid
 *     comprehension and don't trigger vestibular issues).
 *
 *   • Hover gated by capability. The Tailwind preset wraps every
 *     `hover:` in `(hover: hover) and (pointer: fine)`, so :hover
 *     never sticks after a tap on iOS Safari.
 *
 *   • Pure CSS state. No keyframes, no Motion. Copy buttons get
 *     pressed dozens of times in a single dev session; CSS
 *     transitions stay smooth even when the main thread is busy
 *     loading content or running scripts.
 */

import * as React from "react";
import { cva } from "class-variance-authority";

import { CheckIcon, CopyIcon } from "../icons/glyphs";
import { cn } from "../utils/cn";

export const copyButtonVariants = cva(
  cn(
    "group relative isolate inline-flex items-center justify-center select-none",
    "border outline-none",
    "transition-[border-color,background-color,color,transform] duration-fast ease-out",
    "motion-reduce:transition-[border-color,background-color,color]",
    "before:absolute before:inset-[-10px] before:content-['']",
    "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember",
    "disabled:opacity-40 disabled:pointer-events-none"
  ),
  {
    variants: {
      appearance: {
        icon: "h-[24px] w-[24px] rounded-md active:scale-[0.94] motion-reduce:active:scale-100",
        text: cn(
          "h-auto w-auto rounded-md border-0 bg-transparent",
          "px-[6px] py-[2px] font-mono text-[10px] uppercase tracking-[0.04em] tabular-nums"
        ),
      },
      copied: {
        true: "",
        false: "",
      },
    },
    compoundVariants: [
      {
        appearance: "icon",
        copied: false,
        className:
          "border-hairline-strong bg-l-surface-raised text-l-ink-lo hover:border-l-border-strong hover:text-l-ink",
      },
      {
        appearance: "icon",
        copied: true,
        className:
          "border-event-green/40 bg-[rgba(74,222,128,0.08)] text-event-green",
      },
      {
        appearance: "text",
        copied: false,
        className:
          "border-transparent text-ink-dim hover:bg-surface-03 hover:text-ink-hi",
      },
      {
        appearance: "text",
        copied: true,
        className:
          "border-transparent text-event-green hover:bg-surface-03",
      },
    ],
    defaultVariants: {
      appearance: "icon",
      copied: false,
    },
  }
);

/*
 * One layer per state. Both layers occupy the same grid cell so the
 * container sizes to the larger of the two. Visibility flips on a
 * 120ms ease-out crossfade; the outgoing layer scales to 0.92 and
 * picks up a 0.5px blur so the swap reads as a morph, not a cut.
 */
const layerVariants = cva(
  cn(
    "col-start-1 row-start-1 inline-flex items-center justify-center",
    "transition-[opacity,transform,filter] duration-fast ease-out will-change-[opacity,transform,filter]",
    "motion-reduce:transition-[opacity] motion-reduce:duration-fast"
  ),
  {
    variants: {
      visible: {
        true: "opacity-100 scale-100 blur-0",
        false:
          "opacity-0 scale-[0.92] blur-[0.5px] motion-reduce:scale-100 motion-reduce:blur-0",
      },
    },
    defaultVariants: { visible: true },
  }
);

export interface CopyButtonProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    "className" | "children" | "onCopy"
  > {
  text: string;
  /** Milliseconds the "copied" confirmation stays visible. */
  confirmFor?: number;
  /** Render as an icon button (default) or a compact text action. */
  appearance?: "icon" | "text";
  /** Visible label for the text variant; included in the SR label for the icon variant. */
  label?: string;
  /** Visible label after a successful copy. */
  copiedLabel?: string;
  /** Fired after a successful clipboard write. Shadows React's native `onCopy` ClipboardEvent handler — it would never fire on this kind of button anyway. */
  onCopy?: (text: string) => void;
  className?: string;
  ref?: React.Ref<HTMLButtonElement>;
}

/*
 * Best-effort clipboard write. The async API only resolves in secure
 * contexts (https / localhost / .test); fall back to a hidden
 * <textarea> + execCommand so dev tunnels and intranet boxes still
 * give the user the confirmation they expect.
 */
async function writeToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path below
  }

  if (typeof document === "undefined") return false;

  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.top = "0";
  ta.style.left = "0";
  ta.style.opacity = "0";
  ta.style.pointerEvents = "none";
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}

export function CopyButton({
  text,
  confirmFor = 2000,
  appearance = "icon",
  label = "Copy",
  copiedLabel = "Copied",
  onCopy,
  className,
  onClick,
  ref,
  type,
  "aria-label": ariaLabelProp,
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
    const ok = await writeToClipboard(text);
    if (!ok) return;
    setCopied(true);
    onCopy?.(text);
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setCopied(false), confirmFor);
  }, [text, confirmFor, onCopy]);

  const isText = appearance === "text";
  const idleAriaLabel = ariaLabelProp ?? `${label} to clipboard`;
  const copiedAriaLabel = copiedLabel;

  return (
    <button
      {...props}
      ref={ref}
      type={type ?? "button"}
      data-state={copied ? "copied" : "idle"}
      title={copied ? copiedLabel : label}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) void handleCopy();
      }}
      aria-label={copied ? copiedAriaLabel : idleAriaLabel}
      className={cn(copyButtonVariants({ appearance, copied }), className)}
    >
      {isText ? (
        <span className="grid place-items-center">
          <span
            aria-hidden
            className={layerVariants({ visible: !copied })}
          >
            {label}
          </span>
          <span
            aria-hidden
            className={layerVariants({ visible: copied })}
          >
            {copiedLabel}
          </span>
        </span>
      ) : (
        <span className="grid h-3.5 w-3.5 place-items-center">
          <CopyIcon
            size={14}
            aria-hidden
            className={layerVariants({ visible: !copied })}
          />
          <CheckIcon
            size={14}
            aria-hidden
            className={layerVariants({ visible: copied })}
          />
        </span>
      )}

      {/*
       * Off-screen live region. Screen readers get the state change
       * even if focus is elsewhere on the page. Empty string when
       * idle, so the reset to idle (after `confirmFor`) is silent —
       * Emil's rule: announce changes that matter, not bookkeeping.
       */}
      <span aria-live="polite" className="sr-only">
        {copied ? copiedLabel : ""}
      </span>
    </button>
  );
}
