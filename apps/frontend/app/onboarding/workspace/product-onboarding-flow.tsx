"use client";

import {
  OnboardingShell,
  StepConnect,
  StepDescribe,
  StepDone,
  StepMiddleware,
  StepStream,
  type ConnectState,
  type DescribeState,
  type OnboardingStepId,
  type SourceId,
} from "ui/onboarding";

import {
  ONBOARDING_STEPS,
  type ProductOnboardingStep,
} from "./workspace-setup-helpers";

/*
 * Product-side onboarding flow shown once the workspace exists.
 * Pure presentational glue around the `ui/onboarding` step components
 * — all flow state stays in the parent so navigation and persistence
 * decisions live in one place.
 */

export interface ProductOnboardingFlowProps {
  step: ProductOnboardingStep;
  describe: DescribeState;
  onDescribeChange: (next: DescribeState) => void;
  connect: ConnectState;
  onConnectChange: (
    update: ConnectState | ((current: ConnectState) => ConnectState),
  ) => void;
  workspaceName: string;
  onAdvance: (delta: 1 | -1) => void;
  onJumpStep: (id: OnboardingStepId) => void;
  onRestart: () => void;
  onOpenDashboard: () => void;
}

export function ProductOnboardingFlow({
  step,
  describe,
  onDescribeChange,
  connect,
  onConnectChange,
  workspaceName,
  onAdvance,
  onJumpStep,
  onRestart,
  onOpenDashboard,
}: ProductOnboardingFlowProps) {
  const connected = connect.connected as SourceId[];
  const next = () => onAdvance(1);
  const back = () => onAdvance(-1);

  return (
    <OnboardingShell
      currentStep={step}
      steps={ONBOARDING_STEPS}
      onJumpStep={onJumpStep}
      align="center"
    >
      {step === "describe" && (
        <StepDescribe
          value={describe}
          onChange={onDescribeChange}
          onNext={next}
        />
      )}
      {step === "connect" && (
        <StepConnect
          value={connect}
          onChange={onConnectChange}
          onNext={next}
          onBack={back}
        />
      )}
      {step === "stream" && (
        <StepStream value={{ connected }} onNext={next} onBack={back} />
      )}
      {step === "middleware" && (
        <StepMiddleware onNext={next} onBack={back} />
      )}
      {step === "done" && (
        <StepDone
          value={{ name: describe.name || workspaceName, connected }}
          onRestart={onRestart}
          onOpen={onOpenDashboard}
        />
      )}
    </OnboardingShell>
  );
}
