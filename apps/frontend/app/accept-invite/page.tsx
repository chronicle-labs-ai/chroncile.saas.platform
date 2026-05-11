import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthShell, Button, EmptyState } from "ui";

import { getSession } from "@/server/auth/session";
import { workos } from "@/server/auth/workos";

import { AcceptInviteSignedIn } from "./accept-invite-signed-in";

export const dynamic = "force-dynamic";

interface SearchParams {
  invitation_token?: string;
}

function ErrorScreen({ title, body }: { title: string; body: string }) {
  return (
    <AuthShell topbar={{}} align="center">
      <EmptyState
        title={title}
        description={body}
        actions={
          <Button variant="secondary" asChild>
            <Link href="/login">Return to sign in</Link>
          </Button>
        }
      />
    </AuthShell>
  );
}

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const token = typeof params.invitation_token === "string" ? params.invitation_token : "";

  if (!token) {
    return (
      <ErrorScreen
        title="Invitation link is missing or malformed"
        body="Ask the person who invited you to resend the link."
      />
    );
  }

  let invitation;
  try {
    invitation = await workos.userManagement.findInvitationByToken(token);
  } catch (error) {
    console.warn(
      "[accept-invite] findInvitationByToken failed:",
      error instanceof Error ? error.message : error,
    );
    return (
      <ErrorScreen
        title="This invitation isn't valid"
        body="It may have expired or been revoked. Ask the person who invited you to send a new one."
      />
    );
  }

  if (invitation.state !== "pending") {
    const body =
      invitation.state === "accepted"
        ? "You can sign in to access the workspace."
        : "Ask for a new invitation to join.";
    return (
      <ErrorScreen
        title={`This invitation has already been ${invitation.state}`}
        body={body}
      />
    );
  }

  const session = await getSession();

  if (!session.authenticated) {
    const params = new URLSearchParams({
      email: invitation.email,
      invitation_token: token,
    });

    if (invitation.organizationId) {
      try {
        const org = await workos.organizations.getOrganization(
          invitation.organizationId,
        );
        if (org?.name) params.set("organization_name", org.name);
      } catch (err) {
        console.warn(
          "[accept-invite] getOrganization failed, falling back to generic banner:",
          err instanceof Error ? err.message : err,
        );
      }
    }

    redirect(`/signup?${params.toString()}`);
  }

  return (
    <AcceptInviteSignedIn
      invitationId={invitation.id}
      invitationToken={token}
      invitedEmail={invitation.email}
      signedInEmail={session.user.email}
      organizationId={invitation.organizationId ?? null}
    />
  );
}
