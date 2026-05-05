import type {
  ProvisioningStep,
  WorkspaceSetupFieldErrors,
  WorkspaceSetupSub,
} from "ui/auth";
import type { OnboardingStepId } from "ui/onboarding";

import { humanizeBackendError } from "@/server/auth/humanize-backend-error";

/*
 * Static config + small pure helpers for the workspace setup client.
 * Anything that doesn't depend on component state lives here so the
 * client component reads top-to-bottom.
 */

/**
 * Order in which the post-workspace product steps appear. Excludes
 * `"billing"` — that step is owned by the marketing flow, not this
 * client.
 */
export const ONBOARDING_ORDER = [
  "describe",
  "connect",
  "stream",
  "middleware",
  "done",
] as const satisfies readonly OnboardingStepId[];

export type ProductOnboardingStep = (typeof ONBOARDING_ORDER)[number];
export type FlowStep = WorkspaceSetupSub | ProductOnboardingStep;

export const ONBOARDING_STEPS = [
  { id: "describe", label: "Describe" },
  { id: "connect", label: "Connect" },
  { id: "stream", label: "Preview" },
  { id: "middleware", label: "Install" },
  { id: "done", label: "Launch" },
] as const satisfies readonly { id: OnboardingStepId; label: string }[];

export function isProductOnboardingStep(
  step: FlowStep,
): step is ProductOnboardingStep {
  return (ONBOARDING_ORDER as readonly string[]).includes(step);
}

/**
 * Clamp a step transition delta to the bounds of `ONBOARDING_ORDER`.
 * Returns `null` when `current` isn't a product step (caller should
 * ignore the request) or when the step would not change.
 */
export function nextProductStep(
  current: FlowStep,
  delta: 1 | -1,
): ProductOnboardingStep | null {
  if (!isProductOnboardingStep(current)) return null;
  const index = ONBOARDING_ORDER.indexOf(current);
  if (index < 0) return null;
  const next = Math.max(
    0,
    Math.min(ONBOARDING_ORDER.length - 1, index + delta),
  );
  if (next === index) return null;
  return ONBOARDING_ORDER[next];
}

/**
 * Steps to render in the workspace-provisioning progress UI. Mirrors
 * the server-side ordering of operations in `/api/onboarding/workspace`.
 */
export const RUNNING_STEPS: ProvisioningStep[] = [
  {
    label: "Create WorkOS organization",
    state: "running",
    techKey: "workos.organizations.create",
  },
  {
    label: "Attach you as admin",
    state: "pending",
    techKey: "userManagement.createOrganizationMembership",
  },
  {
    label: "Register Chronicle workspace",
    state: "pending",
    techKey: "tenants.registerWorkos",
  },
  {
    label: "Refresh session into workspace",
    state: "pending",
    techKey: "session.refresh",
  },
];

export const DONE_STEPS = RUNNING_STEPS.map((step) => ({
  ...step,
  state: "done" as const,
}));

/*
 * Translate a backend error code into either an inline field error or
 * a top-level banner. Delegates to `humanizeBackendError` which owns
 * the canonical dictionary — see `server/auth/humanize-backend-error.ts`.
 *
 * The colocate-vs-banner decision is driven by the `field` hint on
 * each entry: codes tied to a specific input render next to it
 * ("colocate errors" rule), everything else surfaces as a banner.
 *
 * Unknown codes go to the banner with a generic message — the user
 * never sees the raw code (no more "email already registered to
 * different workos user" leaking into the UI).
 */
export function routeWorkspaceError(code: string): {
  field?: WorkspaceSetupFieldErrors;
  banner?: string;
} {
  const humanized = humanizeBackendError(code);
  if (humanized.field === "orgName") {
    return { field: { orgName: humanized.message } };
  }
  if (humanized.field === "slug") {
    return { field: { slug: humanized.message } };
  }
  return { banner: humanized.message };
}
