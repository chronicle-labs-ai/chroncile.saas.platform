"use client";

import * as React from "react";
import { cx } from "../utils/cx";
import { tv } from "../utils/tv";
import { SourceGlyph } from "../icons/source-glyph";
import type { DomainHint } from "../onboarding/data";
import {
  ParseStrip,
  StatusStrip,
  type ParseStripState,
  type StatusStripTone,
} from "./_internal";

/*
 * DomainDetect — the "we noticed you're at Stripe — we'll wire up
 * your Stripe events workspace" parse strip from the v2 sign-up
 * flow. Pure presentation: it doesn't run the regex itself; the
 * caller passes a `match` (resolved via `detectDomain` from the
 * onboarding data module) plus a `parsing` flag for the typewriter
 * placeholder state.
 *
 * Renders on top of the shared `<ParseStrip>` chrome
 * (idle / parsing / match / nomatch); the only domain-specific bit
 * here is the bordered brand pill + message.
 */

export type { DomainHint };

const detect = tv({
  slots: {
    badge:
      "inline-flex items-center gap-[6px] px-s-2 py-[4px] " +
      "rounded-sm border border-hairline-strong bg-surface-01 " +
      "font-sans text-[12.5px] text-ink-hi",
    badgeIcon: "inline-flex items-center text-ember",
    badgeName: "font-medium",
    badgeMsg: "text-ink-lo font-light",
  },
});

export interface DomainDetectProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Whether the email field is currently being parsed (placeholder while debouncing). */
  parsing?: boolean;
  /** Resolved match — usually `detectDomain(email)`. `null` when no match was found. */
  match?: DomainHint | null;
  /** Whether the user has actually typed an email yet. Drives the empty + nomatch states. */
  hasEmail?: boolean;
  /** Empty-state hint shown before the user types anything. */
  placeholder?: React.ReactNode;
  /** Override the no-match copy. */
  noMatchHint?: React.ReactNode;
}

/**
 * The "we noticed you're at Stripe" parse strip used under the
 * sign-up email field. Pass the resolved `match` from
 * `detectDomain(email)` plus a `parsing` flag — the four
 * idle / parsing / match / nomatch states render automatically.
 */
export function DomainDetect({
  parsing = false,
  match = null,
  hasEmail = false,
  placeholder = "Use a work email — we'll detect your stack.",
  noMatchHint = "No tools matched yet — that's fine, you can connect later.",
  ...rest
}: DomainDetectProps) {
  const slots = detect();

  const state: ParseStripState = !hasEmail
    ? "idle"
    : parsing
      ? "parsing"
      : match
        ? "match"
        : "nomatch";

  return (
    <ParseStrip
      state={state}
      placeholder={placeholder}
      noMatchHint={noMatchHint}
      match={
        match ? (
          <span className={slots.badge()}>
            <span className={slots.badgeIcon()}>
              <SourceGlyph id={match.icon} size={14} />
            </span>
            <b className={slots.badgeName()}>{match.name}</b>
            <span className={slots.badgeMsg()}>— {match.message}</span>
          </span>
        ) : null
      }
      {...rest}
    />
  );
}

/* ── DomainStrip ──────────────────────────────────────────────
 *
 * The discover-driven sibling to DomainDetect. Where DomainDetect
 * reads its match from `detectDomain()` and renders a brand pill,
 * DomainStrip is tone-driven (match / warn / sso / neutral) and
 * surfaces the result of `/api/auth/discover`. The four kinds map
 * 1:1 to the prototype sub-states A.1 / A.1c / A.1p / A.1s + D.2:
 *
 *   tone="match"   — "<domain> — no existing workspace…"
 *   tone="warn"    — "<orgName> already uses Chronicle…"
 *   tone="sso"     — "<orgName> uses single sign-on…"
 *   tone="neutral" — placeholder while we don't know yet.
 *
 * Composes `<StatusStrip variant="banner">` for the shared chrome
 * (role + aria-live + base layout + tone-keyed border/bg) and adds
 * the LED dot + label slot on top. Distinct visual job from
 * ParseStrip's typewriter "we're parsing" indicator, but they share
 * the same scaffold.
 */

export type DomainStripTone = "match" | "warn" | "sso" | "neutral";

/** Mapping the DomainStrip's tone vocabulary to the StatusStrip's. */
const TONE_TO_STATUS: Record<DomainStripTone, StatusStripTone> = {
  match: "match",
  warn: "warn",
  sso: "sso",
  neutral: "neutral",
};

const STRIP_DOT_COLOR: Record<DomainStripTone, string> = {
  match: "bg-event-green",
  warn: "bg-event-amber",
  sso: "bg-event-violet",
  neutral: "bg-ink-dim",
};

export interface DomainStripProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Drives the LED dot color + container tint. */
  tone: DomainStripTone;
  /** Main copy in the strip — usually the discover endpoint's narrative line. */
  label: React.ReactNode;
  /** Optional org name. Not rendered automatically — pass it via `label` if needed; kept on props for parity with the discover payload + analytics. */
  orgName?: string;
}

/**
 * Discover-driven domain strip. Shows a colored LED dot + a single
 * line of copy. Stays in the email-field rail to drive the
 * A.1 / A.1c / A.1p / A.1s + D.2 prototype sub-states.
 */
export function DomainStrip({
  tone,
  label,
  orgName: _orgName,
  className,
  ...rest
}: DomainStripProps) {
  return (
    <StatusStrip
      variant="banner"
      tone={TONE_TO_STATUS[tone]}
      data-domain-tone={tone}
      className={className}
      {...rest}
    >
      <span
        aria-hidden
        className={cx(
          "inline-block h-[8px] w-[8px] shrink-0 rounded-pill",
          STRIP_DOT_COLOR[tone]
        )}
      />
      <span className="flex-1">{label}</span>
    </StatusStrip>
  );
}
