import { NextResponse } from "next/server";

import { requirePermission } from "@/server/auth/permissions";
import { workos } from "@/server/auth/workos";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: Request, ctx: RouteContext) {
  const guard = await requirePermission("members:invite");
  if (guard.response) return guard.response;

  if (!guard.session.organizationId) {
    return NextResponse.json({ error: "no_active_org" }, { status: 409 });
  }

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  let invitation;
  try {
    invitation = await workos.userManagement.getInvitation(id);
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (invitation.organizationId !== guard.session.organizationId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    await workos.userManagement.revokeInvitation(id);
  } catch (error) {
    console.error(
      "[org/invitations/:id][DELETE] revokeInvitation failed:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: "revoke_failed" },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
