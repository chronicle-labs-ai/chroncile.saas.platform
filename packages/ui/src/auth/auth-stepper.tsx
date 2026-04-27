"use client";

import * as React from "react";
import { tv } from "../utils/tv";

/*
 * AuthStepper — pip stepper used inside AuthTopbar and the
 * onboarding shell. Each step renders as a small dot; clicking a
 * dot fires `onJump(index)`. Past steps render as ember chips, the
 * current step is filled, future steps are hairline outlines.
 */

export interface AuthStep {
  /** Stable id; used as React key + passed to onJump callback. */
  id: string;
  /** Visible label (currently shown on the topbar's step counter). */
  label: string;
}

const stepper = tv({
  slots: {
    root: "inline-flex items-center gap-[6px]",
    pip:
      "h-[8px] w-[8px] rounded-pill border transition-colors duration-fast " +
      "outline-none cursor-pointer " +
      "focus-visible:ring-1 focus-visible:ring-ember focus-visible:ring-offset-1 " +
      "focus-visible:ring-offset-page",
  },
  variants: {
    state: {
      idle: {
        pip: "border-hairline-strong bg-transparent hover:border-ink-dim",
      },
      done: { pip: "border-ember bg-ember/40 hover:bg-ember/60" },
      active: { pip: "border-ember bg-ember w-[20px]" },
    },
  },
  defaultVariants: { state: "idle" },
});

export interface AuthStepperProps extends React.HTMLAttributes<HTMLDivElement> {
  steps: AuthStep[];
  currentIndex: number;
  /** When provided, pips become buttons; clicks fire `onJump(index, id)`. */
  onJump?: (index: number, id: string) => void;
}

/**
 * The numbered step pips shown inside `AuthTopbar`. Pass the full
 * step list + the current index; pass `onJump` to make completed
 * pips clickable.
 */
export function AuthStepper({
  steps,
  currentIndex,
  onJump,
  className,
  ...rest
}: AuthStepperProps) {
  const slots = stepper();
  return (
    <div
      role="navigation"
      aria-label="Flow progress"
      className={slots.root({ className })}
      {...rest}
    >
      {steps.map((s, i) => {
        const state =
          i === currentIndex ? "active" : i < currentIndex ? "done" : "idle";
        const pipCls = stepper({ state }).pip();
        if (onJump) {
          return (
            <button
              key={s.id}
              type="button"
              data-state={state}
              aria-label={`${s.label} (step ${i + 1} of ${steps.length})`}
              aria-current={i === currentIndex ? "step" : undefined}
              onClick={() => onJump(i, s.id)}
              className={pipCls}
            />
          );
        }
        return (
          <span
            key={s.id}
            data-state={state}
            aria-label={`${s.label} (step ${i + 1} of ${steps.length})`}
            aria-current={i === currentIndex ? "step" : undefined}
            className={pipCls}
            style={{ cursor: "default" }}
          />
        );
      })}
    </div>
  );
}
