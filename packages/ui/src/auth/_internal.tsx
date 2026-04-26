"use client";

import * as React from "react";
import { cx } from "../utils/cx";
import { tv } from "../utils/tv";
import { AlertIcon, CheckIcon } from "../icons/glyphs";

/*
 * Shared internal helpers for the auth + onboarding screens.
 *
 * These are NOT re-exported from the package barrel and should not be
 * reached for from outside `src/auth/` or `src/onboarding/`. If a
 * helper here grows a third caller in another module, promote it to a
 * proper primitive (or to `icons/`) instead of widening the import.
 */

/* ── Validators ────────────────────────────────────────────── */

/**
 * Auth-flow email validation. Cheap regex (intentionally not RFC-5322)
 * — the server is the source of truth; this is a UX-time hint.
 *
 * Note: `sign-up-email.tsx` also uses a *different* extraction regex in
 * freeform mode (`/[\w.+-]+@[\w-]+\.[\w.-]+/`) — that one is for
 * pulling an email out of a longer string and should NOT be merged
 * with this validator.
 */
export const isValidEmail = (s: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

/* ── InlineAlert ──────────────────────────────────────────── */

export interface InlineAlertProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  tone?: "danger" | "warning" | "info";
  icon?: React.ReactNode;
  /**
   * Optional bold title rendered above the alert body. Used by the
   * sign-up "Looking for an invite?" / "Didn't get the email?"
   * patterns where the title sets the question and `children` is the
   * explanatory paragraph.
   */
  title?: React.ReactNode;
  /**
   * Optional inline-link actions rendered beneath the body — usually
   * a flex row of `<button>` / `<a>` CTAs separated by middots. The
   * slot styles its own gap; consumers can pass any node.
   */
  actions?: React.ReactNode;
}

export function InlineAlert({
  tone = "danger",
  icon,
  title,
  actions,
  className,
  children,
  ...rest
}: InlineAlertProps) {
  const toneCls =
    tone === "danger"
      ? "border-event-red/40 bg-event-red/[0.07] text-event-red"
      : tone === "warning"
        ? "border-event-amber/40 bg-event-amber/[0.07] text-event-amber"
        : "border-hairline-strong bg-surface-01 text-ink-lo";
  return (
    <div
      role="alert"
      className={cx(
        "flex items-start gap-s-2 rounded-sm border px-s-3 py-s-2",
        "font-sans text-[13px] leading-[1.45]",
        toneCls,
        className,
      )}
      {...rest}
    >
      <span className="mt-[2px] inline-flex shrink-0">
        {icon ?? <AlertIcon />}
      </span>
      <div className="flex-1 flex flex-col gap-s-1">
        {title ? (
          <span className="font-medium text-current">{title}</span>
        ) : null}
        {children ? <span>{children}</span> : null}
        {actions ? (
          <div className="cg-inline-actions mt-s-1 flex flex-wrap items-center gap-s-3 text-[12.5px]">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ── StepFoot ─────────────────────────────────────────────── */

export interface StepFootProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Left-side action (back / cancel / etc). */
  back?: React.ReactNode;
  /** Right-side primary action (continue / submit). */
  next?: React.ReactNode;
}

export function StepFoot({
  back,
  next,
  className,
  children,
  ...rest
}: StepFootProps) {
  return (
    <div className={cx("cg-step-foot", className)} {...rest}>
      {children ?? (
        <>
          <span>{back}</span>
          <span>{next}</span>
        </>
      )}
    </div>
  );
}

/* ── Marketing-scale headline + lede ──────────────────────── */
/*
 * These are intentionally distinct from the public `<Display>` /
 * `<Body>` typography primitives — they use the larger
 * `clamp(40px, 6vw, 64px)` marketing scale plus the `cg-fade-up`
 * entrance animation. Renamed from `Display` / `Lede` to dodge the
 * name collision with `typography/Display`.
 */

export const AuthDisplay = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <h1 className={cx("cg-display-h1 cg-fade-up", className)}>{children}</h1>
);

export const AuthLede = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <p className={cx("cg-lede cg-fade-up cg-fade-up-1", className)}>
    {children}
  </p>
);

/* ── UnderlineTabs ────────────────────────────────────────── */
/*
 * The "underlined active tab" segmented control used for the
 * structured / freeform / template switcher in sign-up + describe and
 * for the python / node / curl picker in middleware. Three callers
 * had identical tv() blocks before this lifted out.
 */

const underlineBtn = tv({
  base:
    "relative pb-[6px] -mb-px font-sans text-[13px] font-medium " +
    "border-b-2 border-transparent text-ink-dim hover:text-ink-lo " +
    "transition-colors duration-fast outline-none " +
    "focus-visible:text-ink-hi",
  variants: {
    active: {
      true: "border-ember text-ink-hi hover:text-ink-hi",
      false: "",
    },
  },
});

export interface UnderlineTabsProps<TId extends string>
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  items: ReadonlyArray<readonly [TId, React.ReactNode]>;
  value: TId;
  onChange: (next: TId) => void;
}

export function UnderlineTabs<TId extends string>({
  items,
  value,
  onChange,
  className,
  ...rest
}: UnderlineTabsProps<TId>) {
  return (
    <div
      role="tablist"
      className={cx("flex gap-s-4 border-b border-hairline", className)}
      {...rest}
    >
      {items.map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={value === id}
          onClick={() => onChange(id)}
          className={underlineBtn({ active: value === id })}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/* ── SelectableCard ───────────────────────────────────────── */
/*
 * Bordered tile with the ember-active state used for templates, plan
 * tiers, and similar pickers across sign-up + onboarding.
 */

const selectableCard = tv({
  base:
    "rounded-sm border text-left transition-[border-color,background-color] " +
    "duration-fast outline-none focus-visible:ring-1 focus-visible:ring-ember",
  variants: {
    active: {
      true: "border-ember bg-ember/[0.04] text-ink-hi",
      false:
        "border-hairline bg-surface-01 text-ink hover:border-hairline-strong",
    },
    padding: {
      sm: "px-s-3 py-s-2",
      md: "px-s-4 py-s-3",
      lg: "px-s-4 py-s-4",
    },
    layout: {
      "stack-tight": "flex flex-col gap-[4px]",
      stack: "flex flex-col gap-s-2",
      relaxed: "flex flex-col gap-s-3",
    },
  },
  defaultVariants: { active: false, padding: "sm", layout: "stack-tight" },
});

export interface SelectableCardProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  active?: boolean;
  padding?: "sm" | "md" | "lg";
  layout?: "stack-tight" | "stack" | "relaxed";
  children: React.ReactNode;
}

export function SelectableCard({
  active = false,
  padding = "sm",
  layout = "stack-tight",
  className,
  children,
  ...rest
}: SelectableCardProps) {
  return (
    <button
      type="button"
      data-active={active || undefined}
      className={selectableCard({ active, padding, layout, className })}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ── StatusStrip — shared chrome for ParseStrip + DomainStrip ─ */
/*
 * Both ParseStrip and DomainStrip surface a single line of status
 * copy under the email field, just with different visual jobs:
 *
 *   • ParseStrip is the typewriter-style "we're parsing" indicator
 *     (idle / parsing / match / nomatch) — unbordered, dim text.
 *   • DomainStrip is the persistent discover-result banner
 *     (match / warn / sso / neutral) — bordered, tone-tinted, with
 *     an LED dot.
 *
 * StatusStrip extracts the shared scaffold: `role="status"`,
 * `aria-live="polite"`, the base flex layout, and the typography
 * scale. Tone + variant drive the colored chrome only when needed
 * (banner mode); inline mode keeps the original ParseStrip look.
 */

export type StatusStripTone = "neutral" | "match" | "warn" | "sso" | "dim";

const statusStripStyles = tv({
  base: "flex items-center gap-s-2 font-sans text-[13px] leading-[1.45]",
  variants: {
    variant: {
      inline: "min-h-[28px] flex-wrap",
      banner: "rounded-sm border px-s-3 py-s-2",
    },
    tone: {
      neutral: "",
      dim: "text-ink-dim",
      match: "",
      warn: "",
      sso: "",
    },
  },
  compoundVariants: [
    {
      variant: "banner",
      tone: "neutral",
      class: "border-hairline-strong bg-surface-01 text-ink-lo",
    },
    {
      variant: "banner",
      tone: "dim",
      class: "border-hairline bg-surface-01 text-ink-dim",
    },
    {
      variant: "banner",
      tone: "match",
      class: "border-event-green/30 bg-event-green/[0.06] text-ink-lo",
    },
    {
      variant: "banner",
      tone: "warn",
      class: "border-event-amber/30 bg-event-amber/[0.06] text-ink-lo",
    },
    {
      variant: "banner",
      tone: "sso",
      class: "border-event-violet/30 bg-event-violet/[0.06] text-ink-lo",
    },
  ],
  defaultVariants: { variant: "inline", tone: "dim" },
});

export interface StatusStripProps
  extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "inline" | "banner";
  tone?: StatusStripTone;
}

/**
 * Shared chrome for ParseStrip + DomainStrip. Renders a `role="status"`
 * `aria-live="polite"` div with the base flex + typography scale.
 * Banner variant adds a colored border + tinted background; inline
 * variant keeps the ParseStrip look.
 */
export function StatusStrip({
  variant = "inline",
  tone = "dim",
  className,
  children,
  ...rest
}: StatusStripProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-variant={variant}
      data-tone={tone}
      className={statusStripStyles({ variant, tone, className })}
      {...rest}
    >
      {children}
    </div>
  );
}

/* ── ParseStrip ───────────────────────────────────────────── */
/*
 * The four-state "we're parsing your input" indicator strip used
 * by `DomainDetect` (sign-up "we noticed you're at Stripe") and by
 * `step-describe` (freeform "we spotted Intercom + Shopify + …").
 *
 * Pure layout — the caller decides what to render inside the
 * `match` slot. Without this, every consumer hand-rolled the same
 * `Reading_` typewriter + `Detected:` prefix + nomatch reassurance.
 *
 * Composes `<StatusStrip variant="inline">` for the role + aria +
 * base typography, then layers the four-state body on top.
 */

export type ParseStripState = "idle" | "parsing" | "match" | "nomatch";

export interface ParseStripProps
  extends React.HTMLAttributes<HTMLDivElement> {
  state: ParseStripState;
  /** Empty / pre-input copy. */
  placeholder?: React.ReactNode;
  /** Content rendered when state === "match" (after the "Detected:" label). */
  match?: React.ReactNode;
  /** Override the no-match reassurance copy. */
  noMatchHint?: React.ReactNode;
  /** Override the parsing label (default "Reading"). */
  parsingLabel?: React.ReactNode;
  /** Hide the literal "Detected:" prefix in match state. */
  hideMatchPrefix?: boolean;
}

export function ParseStrip({
  state,
  placeholder,
  match,
  noMatchHint = "No tools matched yet — that's fine, you can connect later.",
  parsingLabel = "Reading",
  hideMatchPrefix = false,
  className,
  ...rest
}: ParseStripProps) {
  return (
    <StatusStrip
      variant="inline"
      tone="dim"
      data-state={state}
      className={className}
      {...rest}
    >
      {state === "idle" ? <span>{placeholder}</span> : null}
      {state === "parsing" ? (
        <span>
          {parsingLabel}
          <span className="cg-blink">_</span>
        </span>
      ) : null}
      {state === "match" ? (
        <>
          {hideMatchPrefix ? null : <span>Detected:</span>}
          {match}
        </>
      ) : null}
      {state === "nomatch" ? <span>{noMatchHint}</span> : null}
    </StatusStrip>
  );
}

/* ── SuccessSeal ──────────────────────────────────────────── */
/*
 * Big green pill with a check inside — the "we did it" confirmation
 * mark used by sign-up-success, auth-success, and forgot-password's
 * confirmation card.
 */

export interface SuccessSealProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Pixel size of the inner check glyph. Defaults to 28. */
  size?: number;
  /** Skip the entrance animation. */
  static?: boolean;
}

export function SuccessSeal({
  size = 28,
  static: isStatic = false,
  className,
  ...rest
}: SuccessSealProps) {
  return (
    <div
      className={cx(
        "inline-flex items-center justify-center rounded-pill",
        "bg-event-green/10 p-s-3 text-event-green",
        isStatic ? null : "cg-fade-up",
        className,
      )}
      {...rest}
    >
      <CheckIcon size={size} />
    </div>
  );
}
