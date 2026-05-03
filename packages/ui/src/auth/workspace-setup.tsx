"use client";

import * as React from "react";
import { Button } from "../primitives/button";
import { Eyebrow } from "../primitives/eyebrow";
import { FormField } from "../primitives/form-field";
import { Input } from "../primitives/input";
import { ScanLoader } from "../primitives/scan-loader";
import { WorkspaceUrlField, slugify } from "../primitives/workspace-url-field";
import { useIsCoarsePointer } from "../utils/use-is-coarse-pointer";
import { ArrowRightIcon } from "../icons/glyphs";
import {
  AuthDisplay,
  AuthLede,
  IdentityCard,
  InlineAlert,
  StepFoot,
  SuccessSeal,
  validateOrgName,
  validateSlug,
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

export interface WorkspaceSetupFieldErrors {
  /** Workspace-name field error (e.g. server-side "name already taken"). */
  orgName?: string | null;
  /** Slug field error (e.g. "slug already taken"). */
  slug?: string | null;
}

export interface WorkspaceSetupProps {
  sub: WorkspaceSetupSub;
  /** Email of the signed-in WorkOS user — drives A.4's identity card. */
  email?: string;
  /** Submit handler for A.4 capture. */
  onSubmit?: (value: WorkspaceSetupCaptureValue) => void;
  /** Initial value for A.4's two fields. */
  defaultValue?: Partial<WorkspaceSetupCaptureValue>;
  /**
   * Top-level / catastrophic error for A.4 (network, unauthorized,
   * unknown server failure). Field-specific errors should be passed
   * via `fieldErrors` so they render inline against the offending
   * input rather than as a banner.
   */
  error?: string | null;
  /**
   * Server-side field errors for A.4. Routed onto the matching
   * `<FormField>` so the user sees the message next to the field
   * that caused it (Emil's "colocate errors" rule). Pass `null` to
   * clear an error after the user starts editing.
   */
  fieldErrors?: WorkspaceSetupFieldErrors;
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

const FORM_ID = "auth-workspace-capture";

function Capture({
  email,
  onSubmit,
  defaultValue,
  error = null,
  fieldErrors,
  isSubmitting = false,
}: WorkspaceSetupProps) {
  const [orgName, setOrgName] = React.useState(defaultValue?.orgName ?? "");
  const [slug, setSlug] = React.useState(defaultValue?.slug ?? "");
  const [slugTouched, setSlugTouched] = React.useState(!!defaultValue?.slug);

  /*
   * Local error state per field. We split "client-side validation
   * (clears on edit)" from "server-side validation (clears on
   * submit-retry)" so a user who corrected their input doesn't
   * still see the stale "name already taken" message.
   */
  const [nameErr, setNameErr] = React.useState<string | null>(null);
  const [slugErr, setSlugErr] = React.useState<string | null>(null);
  /*
   * Submission attempted at least once — gates between gentle
   * (only-on-blur) validation and aggressive (every-keystroke)
   * validation. Avoids screaming at the user before they've
   * finished typing.
   */
  const [tried, setTried] = React.useState(false);

  /* Auto-derive slug from name unless the user has touched it. */
  React.useEffect(() => {
    if (slugTouched) return;
    setSlug(slugify(orgName));
  }, [orgName, slugTouched]);

  /*
   * Re-validate live once we've already tried (and failed) — the
   * form moves to "fix it now" mode and clears each field error
   * the moment it becomes valid. Without this the user has to
   * blur the field again to see the red border drop.
   */
  React.useEffect(() => {
    if (!tried) return;
    setNameErr(validateOrgName(orgName));
    setSlugErr(validateSlug(slug));
  }, [orgName, slug, tried]);

  /*
   * Skip `autoFocus` on touch devices — see Emil's
   * touch-accessibility rules. `useIsCoarsePointer` returns false
   * during SSR + first client render so the markup matches; the
   * effect flips it on touch *after* mount, which silently drops
   * the prop on those devices.
   */
  const isCoarse = useIsCoarsePointer();

  /*
   * Server-side errors win over local validation while present —
   * they describe a server-known truth (e.g. "slug already taken")
   * the client can't infer. Cleared by re-submitting; while typing
   * we keep the local validator in sync below.
   */
  const displayedNameErr = fieldErrors?.orgName || nameErr;
  const displayedSlugErr = fieldErrors?.slug || slugErr;

  const submit = () => {
    setTried(true);
    const nextNameErr = validateOrgName(orgName);
    const nextSlugErr = validateSlug(slug);
    setNameErr(nextNameErr);
    setSlugErr(nextSlugErr);
    if (nextNameErr || nextSlugErr) return;
    onSubmit?.({ orgName: orgName.trim(), slug });
  };

  /*
   * `disabled` state for the Create-workspace button. Different
   * from "validation failed" — keep the button enabled even with
   * empty fields so the first submit reveals the rules. It only
   * goes disabled while the parent is mid-flight.
   */
  const disabled = isSubmitting;

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

      <div className="cg-fade-up cg-fade-up-2 mt-s-8 flex flex-col gap-s-5">
        {/* Identity context strip — replaces the legacy "Almost there"
            InlineAlert. Reads as confirmation, not warning. */}
        {email ? <IdentityCard email={email} /> : null}

        {/* Catastrophic / non-field error banner. Field-specific errors
            land beneath their input via `fieldErrors`. */}
        {error ? <InlineAlert>{error}</InlineAlert> : null}

        <form
          id={FORM_ID}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex flex-col gap-s-3"
        >
          <FormField
            tone="auth"
            label="Workspace name"
            htmlFor="auth-ws-name"
            error={displayedNameErr ?? undefined}
          >
            <Input
              id="auth-ws-name"
              type="text"
              autoComplete="organization"
              placeholder="Acme Industries"
              variant="auth"
              value={orgName}
              onChange={(e) => setOrgName(e.currentTarget.value)}
              onBlur={() => setNameErr(validateOrgName(orgName))}
              invalid={!!displayedNameErr}
              aria-invalid={!!displayedNameErr || undefined}
              aria-describedby={
                displayedNameErr ? "auth-ws-name-error" : undefined
              }
              maxLength={60}
              autoFocus={!isCoarse}
            />
          </FormField>

          <FormField
            tone="auth"
            label="Workspace URL"
            htmlFor="auth-ws-slug"
            error={displayedSlugErr ?? undefined}
          >
            <WorkspaceUrlField
              id="auth-ws-slug"
              value={slug}
              onChange={(s) => {
                setSlugTouched(true);
                setSlug(s);
              }}
              onBlur={() => setSlugErr(validateSlug(slug))}
              invalid={!!displayedSlugErr}
              aria-invalid={!!displayedSlugErr || undefined}
              maxLength={32}
              placeholder="acme-industries"
            />
            {/*
             * Live URL preview — gives the user a concrete picture of
             * what they're committing to without making them read the
             * description paragraph. Goes neutral when empty, ember
             * when present. Sized so the field's `error` slot below
             * (when fired) and this preview row don't fight each
             * other for space.
             */}
            <p
              id="auth-ws-slug-preview"
              className="font-mono text-mono-sm leading-[1.5] text-ink-dim"
            >
              Your URL will be{" "}
              <span
                className={
                  slug
                    ? "text-ink-hi"
                    : "text-ink-faint"
                }
              >
                chronicle.io/{slug || "your-workspace"}
              </span>
              .{" "}
              <span className="text-ink-dim">
                Lowercase letters, numbers, hyphens. Shows up in webhook
                URLs and SDK keys — pick carefully.
              </span>
            </p>
          </FormField>
        </form>
      </div>

      <StepFoot
        back={null}
        next={
          <Button
            variant="ember"
            type="submit"
            form={FORM_ID}
            isLoading={isSubmitting}
            isDisabled={disabled}
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
        Mirroring your tenant to WorkOS, attaching you as the owner, and minting
        your session token.
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
        <span className="text-ink-hi font-medium">{workspaceName}</span> is
        provisioned and your session is signed. Pick how you want to land.
      </AuthLede>

      <div className="cg-fade-up cg-fade-up-2 mt-s-8 flex flex-col items-start gap-s-4">
        <SuccessSeal static />
      </div>

      <StepFoot
        back={
          <Button variant="secondary" onPress={onSkipToDashboard}>
            Skip · explore the dashboard
          </Button>
        }
        next={
          <Button
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
