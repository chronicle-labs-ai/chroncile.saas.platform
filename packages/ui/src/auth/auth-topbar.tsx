"use client";

import * as React from "react";
import { Logo } from "../primitives/logo";
import { AuthStepper, type AuthStep } from "./auth-stepper";
import { tv } from "../utils/tv";

/*
 * AuthTopbar — the v2 topbar from `app-v2.jsx`. Renders the logo
 * (icon + wordmark, theme-aware), an optional step counter, the
 * pip stepper, and a fallback CTA on the right when there's no
 * active flow.
 *
 * This is a *layout* component — state lives in the parent. The
 * topbar takes `steps` + `currentIndex` if a flow is active, or a
 * `cta` slot for the unauthenticated landing screens.
 */

const topbar = tv({
  slots: {
    root:
      "relative z-10 flex h-[64px] w-full items-center justify-between " +
      "px-s-6 border-b border-hairline bg-transparent",
    left: "flex items-center gap-s-3 min-w-0",
    word: "h-[20px] w-auto shrink-0",
    icon: "h-[24px] w-[24px] shrink-0",
    div: "h-[18px] w-px bg-hairline-strong shrink-0 mx-s-1",
    stepLabel:
      "font-mono text-mono-sm uppercase tracking-tactical text-ink-dim " +
      "whitespace-nowrap",
    stepLabelB: "text-ink-hi font-medium",
    right:
      "flex items-center gap-s-3 font-mono text-mono-sm uppercase " +
      "tracking-tactical text-ink-dim",
  },
});

export interface AuthTopbarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Steps for the active flow. Omit (or pass `[]`) when there's no flow. */
  steps?: AuthStep[];
  currentIndex?: number;
  /** Fires when the user clicks a stepper pip (only when steps is provided). */
  onJumpStep?: (index: number, id: string) => void;
  /** Right-side CTA shown when no flow is active. */
  cta?: React.ReactNode;
  /** Optional override for the brand logo (e.g. a customer-branded variant). */
  brand?: React.ReactNode;
}

/**
 * Top bar rendered by `AuthShell` — wordmark on the left, optional
 * step pips in the middle, and a right-side CTA slot (sign-in /
 * sign-up swap, "Skip", etc.).
 */
export function AuthTopbar({
  steps,
  currentIndex = 0,
  onJumpStep,
  cta,
  brand,
  className,
  ...rest
}: AuthTopbarProps) {
  const slots = topbar();
  const hasFlow = steps && steps.length > 0;
  const safeIndex = Math.max(
    0,
    Math.min(currentIndex, (steps?.length ?? 1) - 1)
  );
  const stepLabel = hasFlow ? steps![safeIndex] : null;

  return (
    <header
      className={slots.root({ className })}
      data-slot="auth-topbar"
      {...rest}
    >
      <div className={slots.left()}>
        {brand ?? (
          <>
            <Logo variant="icon" theme="auto" className={slots.icon()} />
            <Logo variant="wordmark" theme="auto" className={slots.word()} />
          </>
        )}
        {hasFlow && stepLabel ? (
          <>
            <span className={slots.div()} aria-hidden />
            <span className={slots.stepLabel()}>
              Step{" "}
              <b className={slots.stepLabelB()}>
                {String(safeIndex + 1).padStart(2, "0")}
              </b>{" "}
              / {String(steps!.length).padStart(2, "0")} · {stepLabel.label}
            </span>
          </>
        ) : null}
      </div>

      {hasFlow ? (
        <AuthStepper
          steps={steps!}
          currentIndex={safeIndex}
          onJump={onJumpStep}
        />
      ) : (
        <div className={slots.right()}>{cta}</div>
      )}
    </header>
  );
}
