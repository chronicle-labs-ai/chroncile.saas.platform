import * as React from "react";

/*
 * Generic SVG glyphs — small, monochrome, theme-aware via `currentColor`.
 *
 * These cover the universal UI affordances (mail, lock, eye, arrow,
 * check, spark, alert) that the auth + onboarding flows reach for. They
 * are siblings to `SourceGlyph` (which is reserved for vendor / data-
 * source marks) and follow the same conventions:
 *
 *   • inherit color from the parent `text-*` (use `style={{ color }}`
 *     or a Tailwind `text-*` class to tint),
 *   • `aria-hidden` by default (decorative — wrap in a labelled element
 *     when meaningful),
 *   • single `size` prop drives both width + height; default is 14px
 *     (form-field affordance scale). 12 is inline-label, 16 is button
 *     glyph, 20 is source-glyph, 28+ is the success-seal hero size.
 *
 * Adding a new glyph: prefer 16×16 viewBox so paths compose cleanly.
 * Keep stroke-width at 1.6 (auto-bumps to 2 above 24px in `CheckIcon`
 * — copy that pattern if your glyph reads thin at large sizes).
 */

export interface IconProps extends Omit<
  React.SVGProps<SVGSVGElement>,
  "width" | "height"
> {
  /** Pixel size for both width + height. Defaults to 14. */
  size?: number;
}

const baseProps = (
  size: number,
  className: string | undefined,
  rest: React.SVGProps<SVGSVGElement>
) => ({
  width: size,
  height: size,
  fill: "none" as const,
  "aria-hidden": true as const,
  className,
  ...rest,
});

/* ── Form-field affordances ────────────────────────────────── */

export const MailIcon = ({ size = 14, className, ...rest }: IconProps) => (
  <svg viewBox="0 0 16 16" {...baseProps(size, className, rest)}>
    <rect
      x="2"
      y="3.5"
      width="12"
      height="9"
      rx="1.5"
      stroke="currentColor"
      strokeWidth="1.2"
    />
    <path
      d="M3 5l5 3.5L13 5"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const LockIcon = ({ size = 14, className, ...rest }: IconProps) => (
  <svg viewBox="0 0 16 16" {...baseProps(size, className, rest)}>
    <rect
      x="3"
      y="7"
      width="10"
      height="7"
      rx="1.5"
      stroke="currentColor"
      strokeWidth="1.2"
    />
    <path
      d="M5 7V5a3 3 0 0 1 6 0v2"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
    />
  </svg>
);

export const UserIcon = ({ size = 14, className, ...rest }: IconProps) => (
  <svg viewBox="0 0 16 16" {...baseProps(size, className, rest)}>
    <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
    <path
      d="M3 13.5c0-2.5 2.2-4 5-4s5 1.5 5 4"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
    />
  </svg>
);

export const EyeIcon = ({ size = 14, className, ...rest }: IconProps) => (
  <svg viewBox="0 0 16 16" {...baseProps(size, className, rest)}>
    <path
      d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8z"
      stroke="currentColor"
      strokeWidth="1.2"
    />
    <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);

export const EyeOffIcon = ({ size = 14, className, ...rest }: IconProps) => (
  <svg viewBox="0 0 16 16" {...baseProps(size, className, rest)}>
    <path
      d="M2 8s2.4-4.5 6.5-4.5c1.4 0 2.6.4 3.6.9M14.5 8s-1.5 2.8-4.4 4M3 3l10 10"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
    />
    <path
      d="M6.5 6.5a2 2 0 0 0 2.8 2.8"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
    />
  </svg>
);

/* ── Arrows ────────────────────────────────────────────────── */

export const ArrowLeftIcon = ({ size = 12, className, ...rest }: IconProps) => (
  <svg viewBox="0 0 12 12" {...baseProps(size, className, rest)}>
    <path
      d="M9.5 6h-7M5 2.5L1.5 6 5 9.5"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ArrowRightIcon = ({
  size = 14,
  className,
  ...rest
}: IconProps) => (
  <svg viewBox="0 0 14 14" {...baseProps(size, className, rest)}>
    <path
      d="M2.5 7h9M8 3.5L11.5 7 8 10.5"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/* ── Check + spark + alert ─────────────────────────────────── */

/**
 * Single check glyph — replaces the four prior implementations
 * (`CheckIcon` / `CheckLgIcon` / `CheckGlyph` / inline copy-button svg).
 * Stroke auto-bumps to 2 above 24px so the seal-size variant stays
 * legible.
 */
export const CheckIcon = ({ size = 14, className, ...rest }: IconProps) => (
  <svg viewBox="0 0 16 16" {...baseProps(size, className, rest)}>
    <path
      d="M3 8.5L6.5 12L13 5"
      stroke="currentColor"
      strokeWidth={size >= 24 ? "2" : "1.6"}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const SparkIcon = ({ size = 12, className, ...rest }: IconProps) => (
  <svg viewBox="0 0 12 12" {...baseProps(size, className, rest)}>
    <path
      d="M6 1l1.3 3.7L11 6l-3.7 1.3L6 11l-1.3-3.7L1 6l3.7-1.3L6 1z"
      fill="currentColor"
    />
  </svg>
);

export const AlertIcon = ({ size = 14, className, ...rest }: IconProps) => (
  <svg viewBox="0 0 14 14" {...baseProps(size, className, rest)}>
    <path
      d="M7 1.5L13 12H1L7 1.5z"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <path
      d="M7 5.5v3M7 10.2v.6"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
    />
  </svg>
);

/* ── Copy state (clipboard) ────────────────────────────────── */

export const CopyIcon = ({ size = 16, className, ...rest }: IconProps) => (
  <svg viewBox="0 0 24 24" {...baseProps(size, className, rest)}>
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
);
