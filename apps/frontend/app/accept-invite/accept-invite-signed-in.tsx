"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface AcceptInviteSignedInProps {
  invitationId: string;
  invitationToken: string;
  invitedEmail: string;
  signedInEmail: string;
  organizationId: string | null;
}

function errorMessage(code: string | undefined): string {
  switch (code) {
    case "email_mismatch":
      return "WorkOS rejected this invitation for the signed-in email. Sign out and back in with the invited address.";
    case "invitation_expired":
      return "This invitation has expired. Ask for a new one.";
    case "invitation_not_found":
      return "This invitation no longer exists.";
    case "not_pending":
      return "This invitation has already been used.";
    case "accept_failed":
      return "WorkOS couldn't accept the invitation. Try again.";
    default:
      return "We couldn't accept the invitation. Try again.";
  }
}

export function AcceptInviteSignedIn({
  invitationId,
  invitationToken,
  invitedEmail,
  signedInEmail,
  organizationId,
}: AcceptInviteSignedInProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailDiffers = invitedEmail.toLowerCase() !== signedInEmail.toLowerCase();

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId, invitationToken }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(errorMessage(data?.error));
        return;
      }
      window.location.assign("/dashboard");
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-md px-6 py-16 font-mono text-sm text-neutral-400">
      <h1 className="text-2xl font-semibold text-neutral-100">
        Accept your invitation
      </h1>
      <p className="mt-3">
        Accepting will add you to the workspace and switch your active workspace to it.
      </p>

      <div className="mt-5 space-y-2 rounded-md border border-neutral-800 px-4 py-3">
        <div>
          <span className="text-neutral-500">Invited:</span>{" "}
          <span className="text-neutral-100">{invitedEmail}</span>
        </div>
        <div>
          <span className="text-neutral-500">Signed in as:</span>{" "}
          <span className="text-neutral-100">{signedInEmail}</span>
        </div>
      </div>

      {emailDiffers ? (
        <p className="mt-4 rounded-md border border-yellow-700/40 bg-yellow-700/10 px-3 py-2 text-yellow-300">
          The invited email differs from your signed-in account. WorkOS may reject this
          based on its domain rules. If it fails, sign out and back in with the invited
          address to retry.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 text-red-400">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={accept}
          disabled={busy || !organizationId}
          className="rounded-md bg-orange-600 px-4 py-2 text-white hover:bg-orange-500 disabled:opacity-50"
        >
          {busy ? "Accepting…" : "Accept invitation"}
        </button>
        {emailDiffers ? (
          <a
            href={`/api/auth/sign-out?from=${encodeURIComponent(`/accept-invite?invitation_token=${invitationToken}`)}`}
            className="rounded-md border border-neutral-700 px-4 py-2 hover:border-neutral-600"
          >
            Sign out
          </a>
        ) : null}
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="rounded-md border border-neutral-700 px-4 py-2 hover:border-neutral-600"
        >
          Not now
        </button>
      </div>
    </main>
  );
}
