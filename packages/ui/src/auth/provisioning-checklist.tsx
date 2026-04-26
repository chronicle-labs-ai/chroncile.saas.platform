"use client";

import * as React from "react";
import { cx } from "../utils/cx";
import { CheckIcon } from "../icons/glyphs";

/*
 * ProvisioningChecklist — controlled list rendered while the
 * workspace bootstrap server actions run (A.5, B.4, C.3a, E.2, F.3).
 *
 * Three indicator states per row:
 *   done    — green-filled circle with white check.
 *   running — ember-pulsing border (uses cg-pulse-ember).
 *   pending — hollow gray border.
 *
 * Each row may carry an optional mono `techKey` (e.g. `users.create`)
 * surfaced on the right edge — that mirrors the prototype's
 * "we're literally telling you what's running" beat. The component
 * is pure presentation; the parent advances `state` as the actions
 * progress.
 */

export type ProvisioningState = "done" | "running" | "pending";

export interface ProvisioningStep {
  /** Human-readable label of the step. */
  label: React.ReactNode;
  /** Current state — drives the indicator. */
  state: ProvisioningState;
  /**
   * Optional mono tech key shown right-aligned, e.g. `users.create`,
   * `workos.organizations.create`. Useful for the "developer-readable
   * inspector" framing in the prototype.
   */
  techKey?: string;
}

export interface ProvisioningChecklistProps
  extends Omit<React.HTMLAttributes<HTMLOListElement>, "children"> {
  steps: ProvisioningStep[];
}

/**
 * Vertical checklist with done / running / pending indicators.
 * Used by every "we're provisioning your workspace" beat across
 * the auth flow.
 */
export function ProvisioningChecklist({
  steps,
  className,
  ...rest
}: ProvisioningChecklistProps) {
  return (
    <ol
      className={cx("flex flex-col gap-s-2", className)}
      data-slot="provisioning-checklist"
      {...rest}
    >
      {steps.map((step, i) => (
        <ProvisioningRow key={i} step={step} />
      ))}
    </ol>
  );
}

function ProvisioningRow({ step }: { step: ProvisioningStep }) {
  const { label, state, techKey } = step;
  return (
    <li
      data-state={state}
      className={cx(
        "flex items-center gap-s-3 rounded-sm",
        "px-s-3 py-s-2",
        "border border-hairline bg-surface-01",
        state === "running" ? "border-hairline-strong" : null,
      )}
    >
      <Indicator state={state} />
      <span
        className={cx(
          "flex-1 font-sans text-[13.5px] leading-[1.45]",
          state === "pending" ? "text-ink-dim" : "text-ink-hi",
          state === "done" ? "text-ink" : null,
        )}
      >
        {label}
      </span>
      {techKey ? (
        <span className="font-mono text-mono-sm text-ink-dim">{techKey}</span>
      ) : null}
    </li>
  );
}

function Indicator({ state }: { state: ProvisioningState }) {
  if (state === "done") {
    return (
      <span
        aria-hidden
        className={cx(
          "inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center",
          "rounded-pill bg-event-green text-ink-inv-hi",
        )}
      >
        <CheckIcon size={11} />
      </span>
    );
  }
  if (state === "running") {
    return (
      <span
        aria-hidden
        className={cx(
          "inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center",
          "rounded-pill border-[1.5px] border-ember bg-ember/[0.08]",
          "cg-pulse-ember",
        )}
      >
        <span className="h-[6px] w-[6px] rounded-pill bg-ember" />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={cx(
        "inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center",
        "rounded-pill border border-hairline-strong bg-transparent",
      )}
    />
  );
}
