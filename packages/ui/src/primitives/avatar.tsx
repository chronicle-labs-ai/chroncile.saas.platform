"use client";

import * as React from "react";

import { tv, type VariantProps } from "../utils/tv";
import { useResolvedChromeDensity } from "../theme/chrome-style-context";

/*
 * Avatar — image with fallback initials. Intentionally simple: we don't
 * need the full Radix Avatar state machine here since our use cases
 * (sidebar user card, workspace switcher) already know when they have
 * an image URL vs. when they should fall back to initials. When an
 * image is provided the component still renders initials as a fallback
 * via the `alt` + error handling.
 */

export type AvatarDensity = "compact" | "brand";

const avatar = tv({
  slots: {
    root:
      "relative inline-flex shrink-0 items-center justify-center overflow-hidden select-none",
    image: "h-full w-full object-cover",
    fallback:
      "flex h-full w-full items-center justify-center text-[0.5em]",
  },
  variants: {
    density: {
      brand: {
        root: "font-mono uppercase text-ink-hi tracking-tactical",
        fallback: "bg-surface-03 tracking-tactical",
      },
      compact: {
        root: "font-sans font-medium text-l-ink",
        fallback: "bg-l-wash-5 tracking-normal",
      },
    },
    size: {
      xs: "h-5 w-5 text-[9px]",
      sm: "h-6 w-6 text-[10px]",
      md: "h-8 w-8 text-[11px]",
      lg: "h-10 w-10 text-[12px]",
      xl: "h-12 w-12 text-[14px]",
    },
    shape: {
      circle: "rounded-full",
      square: { root: "rounded-xs" },
    },
    tone: {
      neutral: "",
      ember: "bg-[rgba(216,67,10,0.12)] text-ember border border-ember/40",
      teal: "bg-[rgba(45,212,191,0.12)] text-event-teal border border-event-teal/40",
      violet:
        "bg-[rgba(139,92,246,0.12)] text-event-violet border border-event-violet/40",
    },
  },
  compoundVariants: [
    { density: "brand", tone: "neutral", class: { root: "bg-surface-03" } },
    { density: "compact", tone: "neutral", class: { root: "bg-l-wash-5" } },
    { density: "compact", shape: "square", class: { root: "rounded-l" } },
  ],
  defaultVariants: {
    size: "md",
    shape: "circle",
    tone: "neutral",
    density: "brand",
  },
});

type AvatarVariantProps = VariantProps<typeof avatar>;

export interface AvatarProps
  extends React.HTMLAttributes<HTMLSpanElement>, AvatarVariantProps {
  /** Image URL. If absent or fails to load, initials render instead. */
  src?: string | null;
  /** Accessible label for the image (or decorative alt fallback). */
  alt?: string;
  /** Explicit initials override. Otherwise computed from `name`. */
  initials?: string;
  /** Full name used to derive initials when `initials` isn't passed. */
  name?: string;
  density?: AvatarDensity;
}

function deriveInitials(
  name: string | undefined,
  override: string | undefined
): string {
  if (override) return override.slice(0, 2).toUpperCase();
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0]?.[0] ?? "?").toUpperCase();
  return (
    (parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")
  ).toUpperCase();
}

export function Avatar({
  src,
  alt = "",
  initials,
  name,
  size,
  shape,
  tone,
  density: densityProp,
  className,
  ...props
}: AvatarProps) {
  const density = useResolvedChromeDensity(densityProp);
  const slots = avatar({ size, shape, tone, density });
  const [imageFailed, setImageFailed] = React.useState(false);
  const showImage = Boolean(src) && !imageFailed;
  const resolvedInitials = deriveInitials(name, initials);

  return (
    <span className={slots.root({ className })} {...props}>
      {showImage ? (
        <img
          src={src ?? undefined}
          alt={alt}
          className={slots.image()}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className={slots.fallback()} aria-hidden={Boolean(alt)}>
          {resolvedInitials}
        </span>
      )}
    </span>
  );
}
