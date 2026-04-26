"use client";

import * as React from "react";
import { Button } from "../primitives/button";
import { Eyebrow } from "../primitives/eyebrow";
import { FormField } from "../primitives/form-field";
import { Input } from "../primitives/input";
import { ScanLoader } from "../primitives/scan-loader";
import {
  WorkspaceUrlField,
  slugify,
} from "../primitives/workspace-url-field";
import { ArrowRightIcon } from "../icons/glyphs";
import {
  AuthDisplay,
  AuthLede,
  InlineAlert,
  StepFoot,
  SuccessSeal,
} from "./_internal";
import {
  ProvisioningChecklist,
  type ProvisioningStep,
} from "./provisioning-checklist";

/*
 * WorkspaceSetup — the `/workspace/setup` page composite. One
 * component renders the three sub-states the prototype defines:
 *
 *   • A.4 — capture: workspace name + URL slug + signed-in-as note.
 *   • A.5 — running: ProvisioningChecklist + ScanLoader.
 *   • A.6 — success: SuccessSeal + greeting + Continue / Skip CTAs.
 *
 * The parent owns the actual server action; we just project state.
 */

export type WorkspaceSetupSub = "capture" | "running" | "success";

export interface WorkspaceSetupCaptureValue {
  orgName: string;
  slug: string;
}

export interface WorkspaceSetupProps {
  sub: WorkspaceSetupSub;
  /** Email of the signed-in WorkOS user — referenced in A.4's alert. */
  email?: string;
  /** Submit handler for A.4 capture. */
  onSubmit?: (value: WorkspaceSetupCaptureValue) => void;
  /** Initial value for A.4's two fields. */
  defaultValue?: Partial<WorkspaceSetupCaptureValue>;
  /** A.4 error banner. */
  error?: string | null;
  /** A.4 in-flight state (the moment between submit and `sub === "running"`). */
  isSubmitting?: boolean;
  /** A.5 — array of provisioning steps. */
  steps?: ProvisioningStep[];
  /** A.6 — first name for the greeting. */
  firstName?: string;
  /** A.6 — workspace name for the bold callout. */
  workspaceName?: string;
  /** A.6 primary CTA — "Continue to onboarding". */
  onContinueOnboarding?: () => void;
  /** A.6 secondary CTA — "Skip · explore the dashboard". */
  onSkipToDashboard?: () => void;
}

/**
 * Page-shaped composite for `/workspace/setup`. Same component
 * renders A.4 (capture), A.5 (running), and A.6 (success) — the
 * parent flips `sub` as the server action progresses.
 */
export function WorkspaceSetup(props: WorkspaceSetupProps) {
  switch (props.sub) {
    case "capture":
      return <Capture {...props} />;
    case "running":
      return <Running {...props} />;
    case "success":
      return <Success {...props} />;
  }
}

/* ── A.4 — capture ────────────────────────────────────────── */

function Capture({
  email,
  onSubmit,
  defaultValue,
  error = null,
  isSubmitting = false,
}: WorkspaceSetupProps) {
  const [orgName, setOrgName] = React.useState(defaultValue?.orgName ?? "");
  const [slug, setSlug] = React.useState(defaultValue?.slug ?? "");
  const [touched, setTouched] = React.useState(!!defaultValue?.slug);

  /* Auto-derive slug from name unless the user has touched it. */
  React.useEffect(() => {
    if (touched) return;
    setSlug(slugify(orgName));
  }, [orgName, touched]);

  const canSubmit = orgName.trim().length >= 2 && slug.length >= 2;

  const submit = () => {
    if (canSubmit) onSubmit?.({ orgName: orgName.trim(), slug });
  };

  return (
    <div className="flex flex-col">
      <Eyebrow>Step 04 · Workspace</Eyebrow>
      <AuthDisplay>
        Name your <em>workspace.</em>
      </AuthDisplay>
      <AuthLede>
        This is where your team&rsquo;s events stream live. Pick a name and a
        URL — both editable later.
      </AuthLede>

      <div className="cg-fade-up cg-fade-up-2 mt-s-8 flex flex-col gap-s-3">
        {error ? <InlineAlert>{error}</InlineAlert> : null}

        {email ? (
          <InlineAlert tone="info" title="Almost there.">
            Signed in as{" "}
            <code className="font-mono text-ink-hi">{email}</code>. We&rsquo;ll
            provision the workspace and route this email&rsquo;s domain to it
            automatically.
          </InlineAlert>
        ) : null}

        <FormField
          tone="auth"
          label={<>Workspace name</>}
          htmlFor="auth-ws-name"
        >
          <Input
            id="auth-ws-name"
            type="text"
            autoComplete="organization"
            placeholder="Acme Industries"
            density="brand"
            variant="auth"
            value={orgName}
            onChange={(e) => setOrgName(e.currentTarget.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            autoFocus
          />
        </FormField>

        <FormField
          tone="auth"
          label={<>Workspace URL</>}
          htmlFor="auth-ws-slug"
          description="Lowercase letters, numbers, and hyphens. Choose carefully — it shows up in webhook URLs and SDK keys."
        >
          <WorkspaceUrlField
            id="auth-ws-slug"
            value={slug}
            onChange={(s) => {
              setTouched(true);
              setSlug(s);
            }}
            placeholder="acme-industries"
          />
        </FormField>
      </div>

      <StepFoot
        back={null}
        next={
          <Button
            density="brand"
            variant="ember"
            isLoading={isSubmitting}
            isDisabled={!canSubmit}
            onPress={submit}
            trailingIcon={!isSubmitting && <ArrowRightIcon />}
          >
            Create workspace
          </Button>
        }
      />
    </div>
  );
}

/* ── A.5 — running ────────────────────────────────────────── */

function Running({ steps = [] }: WorkspaceSetupProps) {
  return (
    <div className="flex flex-col">
      <Eyebrow>Step 04 · Provisioning</Eyebrow>
      <AuthDisplay>
        Wiring your <em>workspace.</em>
      </AuthDisplay>
      <AuthLede>
        Mirroring your tenant to WorkOS, attaching you as the owner, and
        minting your session token.
      </AuthLede>

      <div className="cg-fade-up cg-fade-up-2 mt-s-8 flex flex-col gap-s-4">
        <ProvisioningChecklist steps={steps} />
        <ScanLoader />
      </div>
    </div>
  );
}

/* ── A.6 — success ────────────────────────────────────────── */

function Success({
  firstName,
  workspaceName,
  onContinueOnboarding,
  onSkipToDashboard,
}: WorkspaceSetupProps) {
  const greet = firstName?.trim() || "friend";
  return (
    <div className="flex flex-col">
      <Eyebrow>Step 04 · Workspace ready</Eyebrow>
      <AuthDisplay>
        You&rsquo;re in, <em>{greet}.</em>
      </AuthDisplay>
      <AuthLede>
        <span className="text-ink-hi font-medium">{workspaceName}</span>{" "}
        is provisioned and your session is signed. Pick how you want to land.
      </AuthLede>

      <div className="cg-fade-up cg-fade-up-2 mt-s-8 flex flex-col items-start gap-s-4">
        <SuccessSeal static />
      </div>

      <StepFoot
        back={
          <Button
            density="brand"
            variant="secondary"
            onPress={onSkipToDashboard}
          >
            Skip · explore the dashboard
          </Button>
        }
        next={
          <Button
            density="brand"
            variant="ember"
            onPress={onContinueOnboarding}
            trailingIcon={<ArrowRightIcon />}
          >
            Continue to onboarding
          </Button>
        }
      />
    </div>
  );
}
