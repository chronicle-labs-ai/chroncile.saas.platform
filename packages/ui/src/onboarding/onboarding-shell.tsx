"use client";

import * as React from "react";
import { AuthShell, type AuthShellProps } from "../auth/auth-shell";
import type { AuthStep } from "../auth/auth-stepper";

/*
 * OnboardingShell — thin convenience wrapper around `AuthShell`
 * preset with the canonical 6-step flow. Use `<AuthShell>` directly
 * if you need a different step set.
 *
 * The shell stays purely presentational — flow state lives in the
 * parent. Pass `currentStep` (one of the 6 ids) and the shell wires
 * up the topbar.
 */

export type OnboardingStepId =
  | "describe"
  | "connect"
  | "stream"
  | "middleware"
  | "billing"
  | "done";

export const ONBOARDING_STEPS: readonly AuthStep[] = [
  { id: "describe", label: "Describe" },
  { id: "connect", label: "Connect" },
  { id: "stream", label: "Preview" },
  { id: "middleware", label: "Install" },
  { id: "billing", label: "Billing" },
  { id: "done", label: "Launch" },
];

export interface OnboardingShellProps extends Omit<
  AuthShellProps,
  "topbar" | "children"
> {
  /** Current step id. Default `"describe"`. */
  currentStep?: OnboardingStepId;
  /** Handler for when the user clicks a stepper pip. */
  onJumpStep?: (id: OnboardingStepId) => void;
  /** Override the step labels (e.g. localize). */
  steps?: readonly AuthStep[];
  children: React.ReactNode;
}

/**
 * Thin wrapper around `AuthShell` preset with the canonical
 * 6-step onboarding flow. Use `<AuthShell>` directly if you need
 * a different step set.
 */
export function OnboardingShell({
  currentStep = "describe",
  onJumpStep,
  steps = ONBOARDING_STEPS,
  children,
  ...rest
}: OnboardingShellProps) {
  const idx = Math.max(
    0,
    steps.findIndex((s) => s.id === currentStep)
  );
  return (
    <AuthShell
      {...rest}
      topbar={{
        steps: [...steps],
        currentIndex: idx,
        onJumpStep: onJumpStep
          ? (i) => onJumpStep(steps[i].id as OnboardingStepId)
          : undefined,
      }}
    >
      {children}
    </AuthShell>
  );
}
