import { NextResponse, type NextRequest } from "next/server";

import { requirePermission } from "@/server/auth/permissions";
import { workos } from "@/server/auth/workos";

const ALLOWED_ROLES = new Set(["admin", "member", "viewer"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface CreateBody {
  email?: unknown;
  roleSlug?: unknown;
}

export async function POST(request: NextRequest) {
  const guard = await requirePermission("members:invite");
  if (guard.response) return guard.response;

  if (!guard.session.organizationId) {
    return NextResponse.json({ error: "no_active_org" }, { status: 409 });
  }

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const roleSlug = typeof body.roleSlug === "string" ? body.roleSlug : "member";

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (!ALLOWED_ROLES.has(roleSlug)) {
    return NextResponse.json({ error: "invalid_role" }, { status: 400 });
  }

  try {
    const inv = await workos.userManagement.sendInvitation({
      email,
      organizationId: guard.session.organizationId,
      roleSlug,
      expiresInDays: 7,
      inviterUserId: guard.session.user.id,
    });

    return NextResponse.json({
      invitationId: inv.id,
      email: inv.email,
      state: inv.state,
      expiresAt: inv.expiresAt,
      acceptInvitationUrl: inv.acceptInvitationUrl,
    });
  } catch (error) {
    console.error(
      "[org/invitations][POST] sendInvitation failed:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: "invite_failed" },
      { status: 502 },
    );
  }
}

export async function GET() {
  const guard = await requirePermission("members:read");
  if (guard.response) return guard.response;

  if (!guard.session.organizationId) {
    return NextResponse.json({ error: "no_active_org" }, { status: 409 });
  }

  try {
    const list = await workos.userManagement.listInvitations({
      organizationId: guard.session.organizationId,
    });

    return NextResponse.json({
      invitations: list.data.map((inv) => ({
        id: inv.id,
        email: inv.email,
        state: inv.state,
        expiresAt: inv.expiresAt,
        acceptedAt: inv.acceptedAt,
        revokedAt: inv.revokedAt,
        createdAt: inv.createdAt,
      })),
    });
  } catch (error) {
    console.error(
      "[org/invitations][GET] listInvitations failed:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: "list_failed" },
      { status: 502 },
    );
  }
}
