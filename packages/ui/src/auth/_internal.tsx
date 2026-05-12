"use client";

import * as React from "react";
import { cx } from "../utils/cx";
import { tv } from "../utils/tv";
import { AgentCompanyMark } from "../agents/agent-company-mark";
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

/**
 * Workspace name validator used by `WorkspaceSetup` (A.4) and any
 * future "rename workspace" form. Min 2 / max 60 char window matches
 * the WorkOS `Organization.name` cap.
 *
 * Returns `null` when the name is acceptable, or a short user-facing
 * message when it isn't. The wording is field-error-strip friendly
 * (one line, no period — the `<FormField error>` slot adds chrome).
 */
export function validateOrgName(raw: string): string | null {
  const v = raw.trim();
  if (!v) return "Enter a workspace name";
  if (v.length < 2) return "At least 2 characters";
  if (v.length > 60) return "Keep it under 60 characters";
  return null;
}

/**
 * Slug validator used by `WorkspaceSetup` (A.4). Mirrors the server's
 * shape (`[a-z0-9](?:[a-z0-9-]*[a-z0-9])?`, 2-32) plus a small
 * reserved-name guard so we can fail fast on routes the platform
 * already owns. Server stays source of truth — duplicate-slug
 * collisions land back as a top-level `error` and are routed onto
 * the field via `WorkspaceSetupProps.fieldErrors.slug`.
 */
const SLUG_RESERVED = new Set([
  "admin",
  "api",
  "app",
  "auth",
  "dashboard",
  "docs",
  "help",
  "internal",
  "login",
  "logout",
  "onboarding",
  "settings",
  "signup",
  "support",
  "system",
  "www",
]);

export function validateSlug(raw: string): string | null {
  const v = raw.trim();
  if (!v) return "Enter a URL slug";
  if (v.length < 2) return "At least 2 characters";
  if (v.length > 32) return "Keep it under 32 characters";
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(v)) {
    return "Lowercase letters, numbers, and hyphens only";
  }
  if (SLUG_RESERVED.has(v)) return "That slug is reserved";
  return null;
}

/* ── InlineAlert ──────────────────────────────────────────── */

export interface InlineAlertProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "title"
> {
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
        className
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

/* ── IdentityCard ─────────────────────────────────────────── */
/*
 * Small "you-are-here" surface used at the top of capture screens
 * that already know who the user is — most prominently A.4 of
 * `WorkspaceSetup`, which used to overload `InlineAlert tone="info"`
 * for the same job. The alert chrome reads as a warning ("yellow box
 * = something might be wrong") even though the message is just
 * confirming context, so we render an identity card instead:
 *
 *   ┌────────────────────────────────────────────────────────┐
 *   │ [LOGO]  Signed in as                                    │
 *   │         ayman@chronicle-labs.com                        │
 *   └────────────────────────────────────────────────────────┘
 *   We'll provision the workspace and route this email's
 *   domain to it automatically.
 *
 * Avatar slot is the brand mark for the email's domain, fetched
 * via `<AgentCompanyMark>` (logo.dev + tone-aware tile + Building2
 * fallback). When logo.dev returns a real mark the card reads as a
 * personal identity strip; when it can't, the fallback Building2
 * glyph keeps the tile filled without an empty silhouette.
 *
 * Caption sits OUTSIDE the card so the card stays compositionally
 * tight at single-line height while still leaving room for an
 * explanatory line beneath.
 */

const domainFromEmail = (email: string): string | null => {
  const at = email.lastIndexOf("@");
  if (at < 0 || at === email.length - 1) return null;
  return email.slice(at + 1).toLowerCase();
};

export interface IdentityCardProps {
  /** Email of the signed-in user (drives the brand mark + display). */
  email: string;
  /** Override the leading label. Default: "Signed in as". */
  label?: React.ReactNode;
  /**
   * Sub-caption rendered below the card. Defaults to the routing
   * copy; pass `false` to suppress the caption entirely.
   */
  caption?: React.ReactNode | false;
  className?: string;
}

export function IdentityCard({
  email,
  label = "Signed in as",
  caption,
  className,
}: IdentityCardProps) {
  const domain = domainFromEmail(email);

  return (
    <div className={cx("flex flex-col gap-s-2", className)}>
      <div
        className={cx(
          "flex items-center gap-s-3 rounded-md border border-hairline-strong bg-surface-01",
          // Density rhythm matches input height (`h-9` on coarse) so the
          // card sits flush with the form fields beneath.
          "px-s-3 py-s-2"
        )}
      >
        {/*
         * Brand mark for the user's email domain. `<AgentCompanyMark>`
         * resolves logo.dev for us (with a curated dark/light tone
         * lookup so monochrome marks don't disappear on the dark
         * canvas) and falls back to the Building2 glyph when the
         * domain can't be matched. `name` and `domain` both pass the
         * derived domain so logo.dev queries the exact host the user
         * recognises (`chronicle-labs.com`, not a guessed alias).
         */}
        {domain ? (
          <AgentCompanyMark
            name={domain}
            domain={domain}
            size="md"
            alt={`${domain} logo`}
          />
        ) : (
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-md border border-hairline-strong bg-l-surface-input"
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-mono text-mono-sm uppercase tracking-tactical text-ink-dim">
            {label}
          </span>
          <span
            className="truncate font-mono text-[13px] leading-[1.3] text-ink-hi"
            title={email}
          >
            {email}
          </span>
        </div>
      </div>
      {caption !== false ? (
        <p className="px-[2px] font-sans text-[12.5px] leading-[1.5] text-ink-dim">
          {caption ?? (
            <>
              We&rsquo;ll provision the workspace and route this
              email&rsquo;s domain to it automatically.
            </>
          )}
        </p>
      ) : null}
    </div>
  );
}

/* ── StepFoot ─────────────────────────────────────────────── */

export interface StepFootProps extends React.HTMLAttributes<HTMLDivElement> {
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
}) => <h1 className={cx("cg-display-h1 cg-fade-up", className)}>{children}</h1>;

export const AuthLede = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <p className={cx("cg-lede cg-fade-up cg-fade-up-1", className)}>{children}</p>
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

export interface UnderlineTabsProps<TId extends string> extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "onChange"
> {
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
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  /*
   * Roving focus per W3C tablist: ←/→ cycle, Home/End jump to ends,
   * activation follows focus (matches the visual `active` underline).
   * `tabIndex={-1}` on inactive tabs keeps Tab from stepping through
   * every option.
   */
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const idx = items.findIndex(([id]) => id === value);
    if (idx < 0) return;
    let next = idx;
    if (e.key === "ArrowRight") next = (idx + 1) % items.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    else return;
    e.preventDefault();
    onChange(items[next][0]);
    tabRefs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      onKeyDown={onKeyDown}
      className={cx("flex gap-s-4 border-b border-hairline", className)}
      {...rest}
    >
      {items.map(([id, label], i) => {
        const active = value === id;
        return (
          <button
            key={id}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            tabIndex={active ? 0 : -1}
            aria-selected={active}
            onClick={() => onChange(id)}
            className={underlineBtn({ active })}
          >
            {label}
          </button>
        );
      })}
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

export interface SelectableCardProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "type"
> {
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

export interface StatusStripProps extends React.HTMLAttributes<HTMLDivElement> {
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

export interface ParseStripProps extends React.HTMLAttributes<HTMLDivElement> {
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

/* ── StatusChip ───────────────────────────────────────────── */
/*
 * Tiny uppercase mono chip with an optional leading dot, used across
 * `step-connect`, `step-stream`, and `step-done` to flag source /
 * row state — `DETECTED`, `LIVE`, `BACKFILLING 42%`, `SYNC`,
 * `PAUSED`, etc. Lifted out so every consumer reaches for the same
 * scale (mono-sm + uppercase + tracking-tactical) and the same dot
 * geometry (5×5 pill) instead of redeclaring the layout inline.
 *
 * Tones map to existing event tokens — `ember` for in-progress
 * detection / backfill, `green` for live / done, `amber` for warnings,
 * `dim` for neutral counts. The dot inherits the tone color; pass
 * `pulse` to layer the ember-pulse halo (matches the running
 * indicator at the bottom of `step-connect`'s status bar).
 */

export type StatusChipTone = "ember" | "green" | "amber" | "dim";

const statusChip = tv({
  base:
    "inline-flex items-center gap-[4px] font-mono text-mono-sm uppercase " +
    "tracking-tactical tabular-nums",
  variants: {
    tone: {
      ember: "text-ember",
      green: "text-event-green",
      amber: "text-event-amber",
      dim: "text-ink-dim",
    },
  },
  defaultVariants: { tone: "dim" },
});

const statusDot = tv({
  base: "h-[5px] w-[5px] shrink-0 rounded-pill",
  variants: {
    tone: {
      ember: "bg-ember",
      green: "bg-event-green",
      amber: "bg-event-amber",
      dim: "bg-ink-dim",
    },
  },
  defaultVariants: { tone: "dim" },
});

export interface StatusChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: StatusChipTone;
  /** Render a leading colored dot. */
  dot?: boolean;
  /** Layer the ember-pulse halo on the dot (only meaningful with `dot`). */
  pulse?: boolean;
  children: React.ReactNode;
}

/**
 * Uppercase mono status chip with optional leading dot. Use across
 * onboarding rows + done-state tiles; pick a tone from the event
 * palette so dots and labels read together.
 */
export function StatusChip({
  tone = "dim",
  dot = false,
  pulse = false,
  className,
  children,
  ...rest
}: StatusChipProps) {
  return (
    <span
      data-tone={tone}
      className={statusChip({ tone, className })}
      {...rest}
    >
      {dot ? (
        <span
          aria-hidden
          className={cx(statusDot({ tone }), pulse ? "cg-pulse-ember" : null)}
        />
      ) : null}
      {children}
    </span>
  );
}

/* ── SuccessSeal ──────────────────────────────────────────── */
/*
 * Big green pill with a check inside — the "we did it" confirmation
 * mark used by sign-up-success, auth-success, and forgot-password's
 * confirmation card.
 */

export interface SuccessSealProps extends React.HTMLAttributes<HTMLDivElement> {
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
        className
      )}
      {...rest}
    >
      <CheckIcon size={size} />
    </div>
  );
}
