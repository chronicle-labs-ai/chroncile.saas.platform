"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AuthShell,
  WorkspaceSetup,
  type WorkspaceSetupCaptureValue,
  type WorkspaceSetupFieldErrors,
  type WorkspaceSetupSub,
} from "ui/auth";
import {
  type ConnectState,
  type DescribeState,
} from "ui/onboarding";

import { ProductOnboardingFlow } from "./product-onboarding-flow";
import {
  DONE_STEPS,
  isProductOnboardingStep,
  nextProductStep,
  routeWorkspaceError,
  RUNNING_STEPS,
  type FlowStep,
} from "./workspace-setup-helpers";

interface WorkspaceSetupClientProps {
  email: string;
  firstName?: string | null;
}

/*
 * Workspace provisioning + product onboarding orchestrator.
 *
 * Two flows live in one component because they share state
 * (`describe` seeds `connect.intendedSources`) and a single user
 * journey:
 *
 *   capture / running / success  → owned by WorkspaceSetup (auth shell)
 *   describe / connect / stream / middleware / done
 *                                → owned by ProductOnboardingFlow
 *
 * `flowStep` discriminates which surface renders.
 */
export function WorkspaceSetupClient({
  email,
  firstName,
}: WorkspaceSetupClientProps) {
  const router = useRouter();
  const [flowStep, setFlowStep] = useState<FlowStep>("capture");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<WorkspaceSetupFieldErrors>({});
  const [workspaceName, setWorkspaceName] = useState<string>("");
  const [describe, setDescribe] = useState<DescribeState>({
    mode: "freeform",
  });
  const [connect, setConnect] = useState<ConnectState>({
    connected: [],
    backfills: {},
  });

  useEffect(() => {
    setConnect((current) => ({
      ...current,
      intendedSources: describe.intendedSources,
      sandbox: describe.sandbox,
    }));
  }, [describe.intendedSources, describe.sandbox]);

  const advance = (delta: 1 | -1) => {
    const next = nextProductStep(flowStep, delta);
    if (next) setFlowStep(next);
  };

  async function submit(value: WorkspaceSetupCaptureValue) {
    setError(null);
    setFieldErrors({});
    setWorkspaceName(value.orgName);
    setFlowStep("running");

    try {
      const response = await fetch("/api/onboarding/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        workspace?: { name?: string };
      } | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "workspace_provisioning_failed");
      }

      setWorkspaceName(data?.workspace?.name ?? value.orgName);
      setFlowStep("success");
    } catch (err) {
      const code =
        err instanceof Error ? err.message : "workspace_provisioning_failed";
      const routed = routeWorkspaceError(code);
      setFieldErrors(routed.field ?? {});
      setError(routed.banner ?? null);
      setFlowStep("capture");
    }
  }

  if (isProductOnboardingStep(flowStep)) {
    return (
      <ProductOnboardingFlow
        step={flowStep}
        describe={describe}
        onDescribeChange={setDescribe}
        connect={connect}
        onConnectChange={setConnect}
        workspaceName={workspaceName}
        onAdvance={advance}
        onJumpStep={(id) => {
          if (id !== "billing") setFlowStep(id);
        }}
        onRestart={() => setFlowStep("describe")}
        onOpenDashboard={() => router.push("/dashboard")}
      />
    );
  }

  const workspaceSub = flowStep as WorkspaceSetupSub;

  return (
    <AuthShell
      topbar={{
        steps: [{ id: "workspace", label: "Workspace" }],
        currentIndex: 0,
      }}
      align="center"
    >
      <WorkspaceSetup
        sub={workspaceSub}
        email={email}
        error={error}
        fieldErrors={fieldErrors}
        isSubmitting={workspaceSub === "running"}
        steps={workspaceSub === "success" ? DONE_STEPS : RUNNING_STEPS}
        firstName={firstName ?? undefined}
        workspaceName={workspaceName}
        onSubmit={submit}
        onContinueOnboarding={() => setFlowStep("describe")}
        onSkipToDashboard={() => router.push("/dashboard")}
      />
    </AuthShell>
  );
}
