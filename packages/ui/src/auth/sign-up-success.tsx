"use client";

import * as React from "react";
import { Button } from "../primitives/button";
import { Eyebrow } from "../primitives/eyebrow";
import { ArrowRightIcon } from "../icons/glyphs";
import { AuthDisplay, AuthLede, StepFoot, SuccessSeal } from "./_internal";

/*
 * SignUpSuccess — final sign-up step. Shows the workspace-ready
 * banner with a freshly minted SDK key and a CTA into onboarding.
 *
 * The SDK key is purely cosmetic — the parent passes it in via
 * `sdkKey`. A copy-to-clipboard control is intentionally not
 * included here so the parent can wire its own tracking.
 */

export interface SignUpSuccessProps {
  /** Caller's display name — first name is greeted in the headline. */
  name?: string;
  /** SDK key string to display. */
  sdkKey?: string;
  /** Restart-the-flow handler ("↺ Restart"). */
  onRestart?: () => void;
  /** Primary CTA — usually "Begin setup" → onboarding. */
  onBegin?: () => void;
  /** Override the primary CTA label. */
  beginLabel?: React.ReactNode;
  /** Hide the SDK key reveal block. */
  hideSdkKey?: boolean;
}

/**
 * Sign-up step 04 — workspace-ready confirmation with a freshly
 * minted SDK key reveal and a CTA into onboarding.
 */
export function SignUpSuccess({
  name,
  sdkKey = "chk_live_8f3b…2a01",
  onRestart,
  onBegin,
  beginLabel = "Begin setup",
  hideSdkKey = false,
}: SignUpSuccessProps) {
  const first = (name?.trim() || "friend").split(/\s+/)[0];
  return (
    <div className="flex flex-col">
      <Eyebrow>Step 04 · Workspace ready</Eyebrow>
      <AuthDisplay>
        Welcome to <em>the stream,</em>
        <br />
        {first}.
      </AuthDisplay>
      <AuthLede>
        Your workspace is provisioned. Drop in an SDK key to start
        ingesting events.
      </AuthLede>

      <div className="cg-fade-up cg-fade-up-2 mt-s-8 flex flex-col items-start gap-s-4">
        <SuccessSeal static />

        {hideSdkKey ? null : (
          <div className="flex w-full items-center justify-between rounded-sm border border-hairline-strong bg-surface-01 px-s-3 py-s-2">
            <span className="font-mono text-mono uppercase tracking-tactical text-ink-dim">
              SDK_KEY
            </span>
            <span className="font-mono text-mono-lg text-ink-hi">{sdkKey}</span>
          </div>
        )}
      </div>

      <StepFoot
        back={
          <Button density="brand" variant="ghost" onPress={onRestart}>
            ↺ Restart
          </Button>
        }
        next={
          <Button
            density="brand"
            variant="ember"
            onPress={onBegin}
            trailingIcon={<ArrowRightIcon />}
          >
            {beginLabel}
          </Button>
        }
      />
    </div>
  );
}
