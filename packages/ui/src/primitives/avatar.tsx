"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Avatar as AvatarPrimitive } from "radix-ui";

import { cn } from "../utils/cn";

/*
 * Avatar — shadcn `new-york` compound, ported to Chronicle's unified
 * token system. Composes Radix's `@radix-ui/react-avatar` (re-exported
 * from the `radix-ui` umbrella) so loading state, race conditions on
 * `src` change, and the `onLoadingStatusChange` callback all behave
 * the way upstream specifies.
 *
 * Six exports:
 *   - Avatar           — root, with size / shape / tone variants
 *   - AvatarImage      — `Avatar.Image`, fills the root
 *   - AvatarFallback   — `Avatar.Fallback`, takes the tone class
 *   - AvatarBadge      — bottom-right status overlay
 *   - AvatarGroup      — overlapping cluster
 *   - AvatarGroupCount — "+N" counter chip in a group
 *
 * Every node emits `data-slot="avatar*"`.
 *
 * Sizing / shape:
 *   - 5 sizes (xs/sm/md/lg/xl) instead of upstream's 3 (sm/default/lg) —
 *     keeps parity with the existing call sites.
 *   - `shape: "circle" | "square"` for cards-of-people layouts. Square
 *     uses `rounded-md` (6 px) so the dashboard sidebar's `rounded-lg`
 *     override is no longer necessary.
 *   - `tone` mirrors `LabelColor` (9 hues): neutral / teal / amber /
 *     green / orange / pink / violet / ember / red. The tone class is
 *     applied to the root AND to the fallback so both the tinted
 *     border ring and the inner initials match.
 *
 * Usage:
 *
 *   <Avatar size="md" tone="ember">
 *     <AvatarImage src={user.avatar} alt={user.name} />
 *     <AvatarFallback>{deriveInitials(user.name)}</AvatarFallback>
 *   </Avatar>
 *
 * For status overlays:
 *
 *   <Avatar>
 *     <AvatarImage src="…" alt="…" />
 *     <AvatarFallback>CN</AvatarFallback>
 *     <AvatarBadge tone="green" />
 *   </Avatar>
 *
 * For overlapping clusters:
 *
 *   <AvatarGroup>
 *     <Avatar>…</Avatar>
 *     <Avatar>…</Avatar>
 *     <AvatarGroupCount>+3</AvatarGroupCount>
 *   </AvatarGroup>
 */

export const avatarRootVariants = cva(
  "relative flex shrink-0 overflow-hidden select-none font-sans font-medium text-l-ink",
  {
    variants: {
      size: {
        xs: "size-5 text-[9px]",
        sm: "size-6 text-[10px]",
        md: "size-8 text-[11px]",
        lg: "size-10 text-[12px]",
        xl: "size-12 text-[14px]",
      },
      shape: {
        circle: "rounded-full",
        square: "rounded-md",
      },
      tone: {
        neutral: "bg-l-wash-5",
        teal: "bg-[rgba(45,212,191,0.12)] text-event-teal border border-event-teal/40",
        amber: "bg-[rgba(251,191,36,0.12)] text-event-amber border border-event-amber/40",
        green: "bg-[rgba(74,222,128,0.12)] text-event-green border border-event-green/40",
        orange: "bg-[rgba(216,107,61,0.12)] text-event-orange border border-event-orange/40",
        pink: "bg-[rgba(244,114,182,0.12)] text-event-pink border border-event-pink/40",
        violet: "bg-[rgba(139,92,246,0.12)] text-event-violet border border-event-violet/40",
        ember: "bg-[rgba(216,67,10,0.12)] text-ember border border-ember/40",
        red: "bg-[rgba(239,68,68,0.12)] text-event-red border border-event-red/40",
      },
    },
    defaultVariants: {
      size: "md",
      shape: "circle",
      tone: "neutral",
    },
  }
);

export const avatarImageVariants = cva("aspect-square size-full object-cover");

export const avatarFallbackVariants = cva(
  "flex size-full items-center justify-center text-[0.5em] tracking-normal"
);

export const avatarBadgeVariants = cva(
  "absolute bottom-0 right-0 flex items-center justify-center rounded-full ring-2 ring-page",
  {
    variants: {
      size: {
        xs: "size-1.5",
        sm: "size-2",
        md: "size-2.5",
        lg: "size-3",
        xl: "size-3.5",
      },
      tone: {
        neutral: "bg-l-ink-dim",
        green: "bg-event-green",
        amber: "bg-event-amber",
        red: "bg-event-red",
        ember: "bg-ember",
        teal: "bg-event-teal",
        violet: "bg-event-violet",
      },
    },
    defaultVariants: {
      size: "md",
      tone: "green",
    },
  }
);

export const avatarGroupVariants = cva(
  "flex items-center isolate -space-x-2 [&>*]:ring-2 [&>*]:ring-page"
);

export const avatarGroupCountVariants = cva(
  "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-l-wash-5 font-sans font-medium text-l-ink-lo",
  {
    variants: {
      size: {
        xs: "size-5 text-[9px]",
        sm: "size-6 text-[10px]",
        md: "size-8 text-[11px]",
        lg: "size-10 text-[12px]",
        xl: "size-12 text-[12px]",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

export interface AvatarProps
  extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>,
    VariantProps<typeof avatarRootVariants> {
  ref?: React.Ref<React.ElementRef<typeof AvatarPrimitive.Root>>;
}

export function Avatar({
  className,
  size,
  shape,
  tone,
  ref,
  ...props
}: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      ref={ref}
      data-slot="avatar"
      className={cn(avatarRootVariants({ size, shape, tone }), className)}
      {...props}
    />
  );
}

export interface AvatarImageProps
  extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image> {
  ref?: React.Ref<React.ElementRef<typeof AvatarPrimitive.Image>>;
}

export function AvatarImage({ className, ref, ...props }: AvatarImageProps) {
  return (
    <AvatarPrimitive.Image
      ref={ref}
      data-slot="avatar-image"
      className={cn(avatarImageVariants(), className)}
      {...props}
    />
  );
}

export interface AvatarFallbackProps
  extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback> {
  ref?: React.Ref<React.ElementRef<typeof AvatarPrimitive.Fallback>>;
}

export function AvatarFallback({
  className,
  ref,
  ...props
}: AvatarFallbackProps) {
  return (
    <AvatarPrimitive.Fallback
      ref={ref}
      data-slot="avatar-fallback"
      className={cn(avatarFallbackVariants(), className)}
      {...props}
    />
  );
}

export interface AvatarBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof avatarBadgeVariants> {
  ref?: React.Ref<HTMLSpanElement>;
}

export function AvatarBadge({
  className,
  size,
  tone,
  ref,
  ...props
}: AvatarBadgeProps) {
  return (
    <span
      ref={ref}
      data-slot="avatar-badge"
      className={cn(avatarBadgeVariants({ size, tone }), className)}
      {...props}
    />
  );
}

export interface AvatarGroupProps
  extends React.HTMLAttributes<HTMLDivElement> {
  ref?: React.Ref<HTMLDivElement>;
}

export function AvatarGroup({ className, ref, ...props }: AvatarGroupProps) {
  return (
    <div
      ref={ref}
      data-slot="avatar-group"
      className={cn(avatarGroupVariants(), className)}
      {...props}
    />
  );
}

export interface AvatarGroupCountProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof avatarGroupCountVariants> {
  ref?: React.Ref<HTMLSpanElement>;
}

export function AvatarGroupCount({
  className,
  size,
  ref,
  ...props
}: AvatarGroupCountProps) {
  return (
    <span
      ref={ref}
      data-slot="avatar-group-count"
      className={cn(avatarGroupCountVariants({ size }), className)}
      {...props}
    />
  );
}

/**
 * Tone palette shared by `Avatar` and `AvatarBadge`. Mirrors
 * `LabelColor` so a workspace tagged "ember" in the switcher and an
 * ember badge on a user's avatar render the same hue.
 */
export type AvatarTone =
  | "neutral"
  | "teal"
  | "amber"
  | "green"
  | "orange"
  | "pink"
  | "violet"
  | "ember"
  | "red";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";
export type AvatarShape = "circle" | "square";

/**
 * Derive 1–2 character initials from a `name` (e.g. "Ayman Saleh" →
 * "AS"). Pass an `override` to short-circuit (clipped to 2 chars).
 * Returns `"?"` when no signal is available.
 *
 * Designed for use inside `<AvatarFallback>{deriveInitials(name)}</AvatarFallback>`,
 * but generic enough to power any "first-letter" affordance.
 */
export function deriveInitials(
  name: string | undefined | null,
  override?: string | null
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
