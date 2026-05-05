import * as React from "react";

/*
 * InvitationBanner — small status notice rendered above the signup
 * form when the user arrives via an invitation link. Calls out the
 * workspace name and offers a "sign in instead" escape hatch.
 *
 * Visually a warning-tone banner. Colors come from Chronicle's event
 * palette (`text-event-amber` + matching tinted fill / border) so the
 * app never reaches for raw `bg-orange-700/10` Tailwind.
 */
export interface InvitationBannerProps {
  /** Workspace name surfaced in the headline. */
  orgName?: string | null;
  /** Triggered by the inline "Sign in instead" link. */
  onSignIn: () => void;
}

export function InvitationBanner({ orgName, onSignIn }: InvitationBannerProps) {
  return (
    <div
      role="status"
      className="mb-6 rounded-md border border-event-amber/40 bg-[rgba(251,191,36,0.06)] px-4 py-3 font-mono text-xs text-event-amber"
    >
      <p>
        You&apos;ve been invited to join{" "}
        <span className="font-semibold text-ink-hi">
          {orgName ?? "a workspace"}
        </span>
        . Create your account to accept.
      </p>
      <p className="mt-1 text-l-ink-lo">
        Already have an account?{" "}
        <button
          type="button"
          onClick={onSignIn}
          className="underline underline-offset-2 transition-colors hover:text-ink-hi"
        >
          Sign in instead
        </button>
        .
      </p>
    </div>
  );
}
