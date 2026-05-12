"use client";

import * as React from "react";
import { Spinner } from "../primitives/spinner";
import { AuthDisplay, AuthLede, SuccessSeal } from "./_internal";

/*
 * AuthSuccess — generic positive-confirmation card for the moments
 * between sign-in success and "we just navigated you to /inbox".
 * Pairs the green check mark, a one-line headline, and a subtle
 * loading line.
 */

export interface AuthSuccessProps {
  /** Headline. Default "You're in." */
  headline?: React.ReactNode;
  /** Sub-line. Default "Loading your workspace…" */
  message?: React.ReactNode;
  /** Optional caption / route preview. */
  caption?: React.ReactNode;
  /** Hide the inline loading spinner under the message. */
  hideSpinner?: boolean;
}

/**
 * Generic positive-confirmation card — green seal + headline +
 * subtle "loading workspace…" line. Used as the bridge frame
 * between sign-in success and the post-auth route.
 */
export function AuthSuccess({
  headline = (
    <>
      You&rsquo;re <em>in.</em>
    </>
  ),
  message = "Loading your workspace…",
  caption,
  hideSpinner = false,
}: AuthSuccessProps) {
  return (
    <div className="flex flex-col items-start">
      <SuccessSeal />
      <div className="mt-s-5">
        <AuthDisplay>{headline}</AuthDisplay>
        <AuthLede>{message}</AuthLede>
      </div>
      {hideSpinner && !caption ? null : (
        <div className="cg-fade-up cg-fade-up-2 mt-s-6 inline-flex items-center gap-s-2 font-mono text-mono-sm text-ink-dim">
          {hideSpinner ? null : <Spinner size="sm" tone="ember" />}
          {caption ?? null}
        </div>
      )}
    </div>
  );
}
