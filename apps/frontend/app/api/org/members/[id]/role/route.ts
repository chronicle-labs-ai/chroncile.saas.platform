import { NextResponse, type NextRequest } from "next/server";

import {
  ADMIN_ROLE_SLUG,
  getOwnerUserId,
  listActiveAdmins,
} from "@/server/auth/org-helpers";
import { requirePermission } from "@/server/auth/permissions";
import { workos } from "@/server/auth/workos";

const ALLOWED_ROLES = new Set(["admin", "member", "viewer"]);

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface Body {
  roleSlug?: unknown;
}

export async function PATCH(request: NextRequest, ctx: RouteContext) {
  const guard = await requirePermission("members:role:update");
  if (guard.response) return guard.response;

  if (!guard.session.organizationId) {
    return NextResponse.json({ error: "no_active_org" }, { status: 409 });
  }
  const orgId = guard.session.organizationId;
  const { id: membershipId } = await ctx.params;
  if (!membershipId) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const roleSlug = typeof body.roleSlug === "string" ? body.roleSlug : "";
  if (!ALLOWED_ROLES.has(roleSlug)) {
    return NextResponse.json({ error: "invalid_role" }, { status: 400 });
  }

  let target;
  try {
    target = await workos.userManagement.getOrganizationMembership(membershipId);
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (target.organizationId !== orgId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const ownerUserId = await getOwnerUserId(orgId);
  if (ownerUserId && ownerUserId === target.userId) {
    return NextResponse.json(
      { error: "cannot_change_owner_role" },
      { status: 409 },
    );
  }

  if (target.role?.slug === ADMIN_ROLE_SLUG && roleSlug !== ADMIN_ROLE_SLUG) {
    const admins = await listActiveAdmins(orgId);
    if (admins.length <= 1 && admins.some((a) => a.userId === target.userId)) {
      return NextResponse.json({ error: "last_admin" }, { status: 409 });
    }
  }

  try {
    const updated = await workos.userManagement.updateOrganizationMembership(
      membershipId,
      { roleSlug },
    );
    return NextResponse.json({
      ok: true,
      membership: {
        id: updated.id,
        userId: updated.userId,
        role: { slug: updated.role?.slug ?? null },
        status: updated.status,
      },
    });
  } catch (error) {
    console.error(
      "[org/members/:id/role][PATCH] updateOrganizationMembership failed:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json({ error: "update_failed" }, { status: 502 });
  }
}
