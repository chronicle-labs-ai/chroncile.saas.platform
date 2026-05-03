"use client";

import * as React from "react";
import { cva } from "class-variance-authority";

import { CheckIcon } from "../icons/glyphs";

export const passwordMeterRootVariants = cva("flex flex-col gap-[6px]");

export const passwordMeterBarsVariants = cva("flex gap-[4px]");

export const passwordMeterBarVariants = cva(
  "h-[3px] flex-1 transition-colors duration-fast ease-out rounded-pill bg-l-wash-5"
);

export const passwordMeterMetaVariants = cva(
  "flex items-center justify-between font-sans text-[12px] font-medium text-l-ink-dim"
);

export const passwordMeterStrengthVariants = cva("text-l-ink-lo");

export const passwordMeterRulesVariants = cva(
  "grid grid-cols-2 gap-x-s-3 gap-y-[6px] mt-s-1"
);

export const passwordMeterRuleVariants = cva(
  "inline-flex items-center gap-[6px] font-sans text-[12px] text-l-ink-dim"
);

export const passwordMeterRuleCheckVariants = cva(
  "inline-flex h-[12px] w-[12px] items-center justify-center text-transparent rounded-pill border border-hairline-strong",
  {
    variants: {
      met: {
        true: "text-ink-hi border-event-green/60 bg-event-green/15 [&>svg]:text-event-green",
      },
    },
  }
);

/*
 * scorePassword — heuristic 0..4. The four bars correspond to
 *   1: 8+ chars
 *   2: 12+ chars
 *   3: mixed case
 *   4: digit AND symbol
 *
 * Cheap, on-the-keystroke. Real auth passwords should still hit the
 * server-side check; this is a UX hint to teach a stronger choice.
 */
export function scorePassword(pw: string): 0 | 1 | 2 | 3 | 4 {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
}

const STRENGTH_LABELS = [
  "Empty",
  "Weak",
  "Fair",
  "Strong",
  "Excellent",
] as const;

const SCORE_COLORS: Record<number, string> = {
  1: "bg-event-red",
  2: "bg-event-amber",
  3: "bg-event-green",
  4: "bg-event-green",
};

const STRENGTH_TONE: Record<number, string> = {
  0: "text-ink-dim",
  1: "text-event-red",
  2: "text-event-amber",
  3: "text-event-green",
  4: "text-event-green",
};

export interface PasswordMeterProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Password value to score. */
  value: string;
  /** Hide the rule list. The bar + label still render. */
  hideRules?: boolean;
}

/**
 * Live password-strength meter — four-bar score readout plus a
 * checklist of the rules met so far. Drives off `scorePassword(v)`.
 */
export function PasswordMeter({
  value,
  hideRules = false,
  className,
  ...rest
}: PasswordMeterProps) {
  const score = scorePassword(value);
  const label = STRENGTH_LABELS[score];

  const rules = [
    { ok: value.length >= 8, txt: "8+ characters" },
    { ok: /[A-Z]/.test(value), txt: "Uppercase letter" },
    { ok: /\d/.test(value), txt: "Number" },
    { ok: /[^A-Za-z0-9]/.test(value), txt: "Symbol" },
  ];

  return (
    <div
      className={passwordMeterRootVariants({ className })}
      data-score={score}
      role="status"
      aria-label={`Password strength: ${label}`}
      {...rest}
    >
      <div className={passwordMeterBarsVariants()}>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={
              passwordMeterBarVariants() +
              (i <= score ? ` ${SCORE_COLORS[score] ?? "bg-ember"}` : "")
            }
          />
        ))}
      </div>
      <div className={passwordMeterMetaVariants()}>
        <span>Strength</span>
        <b className={`font-medium ${STRENGTH_TONE[score] ?? ""}`}>{label}</b>
      </div>
      {hideRules ? null : (
        <div className={passwordMeterRulesVariants()}>
          {rules.map((r) => (
            <span
              key={r.txt}
              className={passwordMeterRuleVariants()}
              data-met={r.ok || undefined}
            >
              <span
                className={passwordMeterRuleCheckVariants({
                  met: r.ok || undefined,
                })}
              >
                {r.ok ? <CheckIcon size={8} /> : null}
              </span>
              {r.txt}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
