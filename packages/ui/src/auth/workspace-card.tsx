"use client";

import * as React from "react";
import { cx } from "../utils/cx";
import { ArrowRightIcon } from "../icons/glyphs";

/*
 * WorkspaceCard — used by the workspace picker (G.2 / G.5) to
 * surface each membership the signed-in user has. Renders as a
 * pressable card with:
 *
 *   • a 32–40 px gradient initial chip (deterministic from the
 *     workspace name or `brandSeed`),
 *   • the workspace name (bold),
 *   • a meta line "Role · N members · last seen Xh ago",
 *   • a trailing arrow.
 *
 * The hover/focus state lifts the border to ember.
 */

export type Role = "Owner" | "Admin" | "Member" | "Viewer";

export interface WorkspaceCardProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "type"
> {
  name: string;
  role: Role;
  memberCount?: number;
  /** e.g. "2h ago", "yesterday", "now". Free-form string. */
  lastSeen?: string;
  /** Override the brand mark seed (defaults to first character of `name`). */
  brandSeed?: string;
  /** Press handler (alias for native onClick to match the rest of the auth API). */
  onPress?: () => void;
}

/* Six ember-friendly gradients, picked deterministically by hashing
 * the seed. Each pair stays within the brand arc (ember → bronze →
 * gold → sage). The contrast of `currentColor` (white in dark mode,
 * warm dark in light mode) flips via the `text-ink-inv-hi` token on
 * the chip. */
const BRAND_GRADIENTS = [
  "linear-gradient(135deg, #d8430a 0%, #905838 100%)",
  "linear-gradient(135deg, #905838 0%, #b09b74 100%)",
  "linear-gradient(135deg, #709188 0%, #3e547c 100%)",
  "linear-gradient(135deg, #b09b74 0%, #786e68 100%)",
  "linear-gradient(135deg, #d8430a 0%, #b83606 100%)",
  "linear-gradient(135deg, #3e547c 0%, #709188 100%)",
];

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function gradientFor(seed: string): string {
  return (
    BRAND_GRADIENTS[hash(seed) % BRAND_GRADIENTS.length] ?? BRAND_GRADIENTS[0]
  );
}

/**
 * Pressable workspace row used in the multi-workspace picker
 * (G.2/G.5). Brand-mark gradient initial chip + role/members/last-seen
 * meta line + arrow.
 */
export function WorkspaceCard({
  name,
  role,
  memberCount,
  lastSeen,
  brandSeed,
  onPress,
  onClick,
  className,
  disabled,
  ...rest
}: WorkspaceCardProps) {
  const seed = (brandSeed || name || "?").trim() || "?";
  const initial = seed.charAt(0).toUpperCase();
  const gradient = gradientFor(seed);

  const meta: string[] = [role];
  if (typeof memberCount === "number")
    meta.push(`${memberCount} member${memberCount === 1 ? "" : "s"}`);
  if (lastSeen) meta.push(`last seen ${lastSeen}`);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        onClick?.(e);
        onPress?.();
      }}
      data-role={role}
      className={cx(
        "group flex w-full items-center gap-s-3 rounded-sm",
        "border border-hairline bg-surface-01 px-s-3 py-s-3 text-left",
        "transition-[border-color,background-color] duration-fast ease-out",
        "hover:border-ember hover:bg-surface-02",
        "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ember",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        className
      )}
      {...rest}
    >
      <span
        aria-hidden
        className={cx(
          "inline-flex h-[36px] w-[36px] shrink-0 items-center justify-center",
          "rounded-sm font-display text-[18px] font-medium leading-none",
          "text-ink-inv-hi shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
        )}
        style={{ background: gradient }}
      >
        {initial}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
        <span className="font-sans text-[14px] font-medium text-ink-hi">
          {name}
        </span>
        <span className="font-mono text-mono-sm text-ink-dim">
          {meta.join(" · ")}
        </span>
      </span>
      <span
        aria-hidden
        className={cx(
          "inline-flex shrink-0 items-center justify-center text-ink-dim",
          "transition-[color,transform] duration-fast ease-out",
          "group-hover:text-ember group-hover:translate-x-[2px]"
        )}
      >
        <ArrowRightIcon size={14} />
      </span>
    </button>
  );
}
