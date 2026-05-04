import { NextResponse, type NextRequest } from "next/server";

import { getBackendUrl } from "platform-api";

import { requireSession } from "@/server/auth/permissions";
import {
  getCookiePassword,
  loadSession,
  setSealedSession,
} from "@/server/auth/session";
import { workos } from "@/server/auth/workos";

interface Body {
  invitationId?: unknown;
  invitationToken?: unknown;
}

export async function POST(request: NextRequest) {
  const guard = await requireSession();
  if (guard.response) return guard.response;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const invitationId = typeof body.invitationId === "string" ? body.invitationId : "";
  const invitationToken = typeof body.invitationToken === "string" ? body.invitationToken : "";
  if (!invitationId || !invitationToken) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  let invitation;
  try {
    invitation = await workos.userManagement.findInvitationByToken(invitationToken);
  } catch {
    return NextResponse.json({ error: "invitation_not_found" }, { status: 404 });
  }
  if (invitation.id !== invitationId) {
    return NextResponse.json({ error: "invitation_mismatch" }, { status: 400 });
  }
  if (invitation.state !== "pending") {
    return NextResponse.json(
      { error: invitation.state === "expired" ? "invitation_expired" : "not_pending" },
      { status: 410 },
    );
  }

  try {
    await workos.userManagement.acceptInvitation(invitationId);
  } catch (error) {
    console.error(
      "[auth/accept-invite] acceptInvitation failed:",
      error instanceof Error ? error.message : error,
    );
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("email") || message.includes("domain")) {
      return NextResponse.json({ error: "email_mismatch" }, { status: 409 });
    }
    return NextResponse.json({ error: "accept_failed" }, { status: 502 });
  }

  // Sync the new membership to the backend BEFORE rebinding the session,
  // so the dashboard layout's membership check passes on the very first
  // request after the redirect. WorkOS owns the auth side; we own the
  // tenant_memberships table.
  if (invitation.organizationId) {
    const serviceSecret = process.env.SERVICE_SECRET;
    if (!serviceSecret) {
      console.error(
        "[auth/accept-invite] SERVICE_SECRET missing — backend membership won't be created",
      );
      return NextResponse.json(
        { error: "service_secret_not_configured" },
        { status: 500 },
      );
    }

    try {
      const registerRes = await fetch(
        `${getBackendUrl()}/api/platform/tenants/register-workos`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceSecret,
            workosUserId: guard.session.user.id,
            workosOrganizationId: invitation.organizationId,
            email: guard.session.user.email,
            // Empty name/slug → backend takes the "tenant already exists"
            // branch and just upserts the membership row.
            name: "",
            slug: "",
            firstName: guard.session.user.firstName ?? null,
            lastName: guard.session.user.lastName ?? null,
          }),
        },
      );

      if (!registerRes.ok) {
        const detail = await registerRes.text().catch(() => "");
        console.error(
          "[auth/accept-invite] backend register-workos returned non-ok",
          registerRes.status,
          detail,
        );
        return NextResponse.json(
          { error: "membership_sync_failed", backendStatus: registerRes.status },
          { status: 502 },
        );
      }
    } catch (error) {
      console.error(
        "[auth/accept-invite] backend register-workos network error:",
        error instanceof Error ? error.message : error,
      );
      return NextResponse.json(
        { error: "backend_unreachable" },
        { status: 502 },
      );
    }
  }

  if (invitation.organizationId) {
    const sealed = await loadSession();
    if (sealed) {
      try {
        const refresh = await sealed.refresh({
          cookiePassword: getCookiePassword(),
          organizationId: invitation.organizationId,
        });
        if (refresh.authenticated) {
          await setSealedSession(refresh.sealedSession);
        } else {
          console.warn(
            "[auth/accept-invite] sealed.refresh failed:",
            refresh.reason,
          );
        }
      } catch (error) {
        console.warn(
          "[auth/accept-invite] sealed.refresh threw:",
          error instanceof Error ? error.message : error,
        );
      }
    }
  }

  return NextResponse.json({
    ok: true,
    organizationId: invitation.organizationId ?? null,
  });
}
