"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  Alert,
  AuthShell,
  Button,
  KvGrid,
} from "ui";

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
    <AuthShell topbar={{}} align="center">
      <div className="flex flex-col gap-s-6">
        <header className="flex flex-col gap-s-2">
          <h1 className="m-0 font-display text-[28px] font-medium tracking-tight text-ink-hi">
            Accept your invitation
          </h1>
          <p className="m-0 font-sans text-body-sm text-ink-lo">
            Accepting will add you to the workspace and switch your active
            workspace to it.
          </p>
        </header>

        <KvGrid
          items={[
            { label: "Invited", value: invitedEmail },
            { label: "Signed in as", value: signedInEmail },
          ]}
        />

        {emailDiffers ? (
          <Alert variant="warning">
            The invited email differs from your signed-in account. WorkOS may
            reject this based on its domain rules. If it fails, sign out and
            back in with the invited address to retry.
          </Alert>
        ) : null}

        {error ? <Alert variant="danger">{error}</Alert> : null}

        <div className="flex flex-wrap items-center gap-s-2">
          <Button
            variant="primary"
            isDisabled={busy || !organizationId}
            isLoading={busy}
            onPress={accept}
          >
            {busy ? "Accepting…" : "Accept invitation"}
          </Button>
          {emailDiffers ? (
            <Button variant="secondary" asChild>
              <a
                href={`/api/auth/sign-out?from=${encodeURIComponent(`/accept-invite?invitation_token=${invitationToken}`)}`}
              >
                Sign out
              </a>
            </Button>
          ) : null}
          <Button variant="ghost" onPress={() => router.push("/dashboard")}>
            Not now
          </Button>
        </div>
      </div>
    </AuthShell>
  );
}
