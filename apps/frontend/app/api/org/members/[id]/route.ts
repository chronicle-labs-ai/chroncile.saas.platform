import { NextResponse, type NextRequest } from "next/server";

import {
  ADMIN_ROLE_SLUG,
  getOwnerUserId,
  listActiveAdmins,
} from "@/server/auth/org-helpers";
import {
  hasPermission,
  requireSession,
} from "@/server/auth/permissions";
import { workos } from "@/server/auth/workos";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface Body {
  mode?: unknown;
}

export async function DELETE(request: NextRequest, ctx: RouteContext) {
  const guard = await requireSession();
  if (guard.response) return guard.response;

  if (!guard.session.organizationId) {
    return NextResponse.json({ error: "no_active_org" }, { status: 409 });
  }
  const orgId = guard.session.organizationId;
  const callerUserId = guard.session.user.id;

  const { id: membershipId } = await ctx.params;
  if (!membershipId) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  let body: Body = {};
  try {
    body = (await request.json().catch(() => ({}))) as Body;
  } catch {
    body = {};
  }
  const requestedMode = body.mode === "leave" ? "leave" : "remove";

  let target;
  try {
    target = await workos.userManagement.getOrganizationMembership(membershipId);
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (target.organizationId !== orgId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const isSelf = target.userId === callerUserId;
  const mode = isSelf ? requestedMode : "remove";

  const ownerUserId = await getOwnerUserId(orgId);
  if (ownerUserId && ownerUserId === target.userId) {
    return NextResponse.json(
      { error: isSelf ? "owner_cannot_leave" : "cannot_remove_owner" },
      { status: 409 },
    );
  }

  if (!(mode === "leave" && isSelf)) {
    if (!hasPermission(guard.session, "members:remove")) {
      return NextResponse.json(
        { error: "forbidden", required: "members:remove" },
        { status: 403 },
      );
    }
  }

  if (target.role?.slug === ADMIN_ROLE_SLUG && target.status === "active") {
    const admins = await listActiveAdmins(orgId);
    if (admins.length <= 1 && admins.some((a) => a.userId === target.userId)) {
      return NextResponse.json({ error: "last_admin" }, { status: 409 });
    }
  }

  try {
    await workos.userManagement.deactivateOrganizationMembership(membershipId);
  } catch (error) {
    console.error(
      "[org/members/:id][DELETE] deactivateOrganizationMembership failed:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json({ error: "deactivate_failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, mode });
}
