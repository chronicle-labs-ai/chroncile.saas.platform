import { NextResponse } from "next/server";

import { getOwnerUserId } from "@/server/auth/org-helpers";
import { requirePermission } from "@/server/auth/permissions";
import { workos } from "@/server/auth/workos";

interface UserSummary {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

async function fetchUsers(userIds: string[]): Promise<Map<string, UserSummary>> {
  const out = new Map<string, UserSummary>();
  await Promise.all(
    userIds.map(async (id) => {
      try {
        const u = await workos.userManagement.getUser(id);
        out.set(id, {
          id: u.id,
          email: u.email,
          firstName: u.firstName ?? null,
          lastName: u.lastName ?? null,
        });
      } catch (error) {
        console.warn(
          "[org/members] getUser failed:",
          id,
          error instanceof Error ? error.message : error,
        );
      }
    }),
  );
  return out;
}

export async function GET() {
  const guard = await requirePermission("members:read");
  if (guard.response) return guard.response;

  if (!guard.session.organizationId) {
    return NextResponse.json({ error: "no_active_org" }, { status: 409 });
  }
  const orgId = guard.session.organizationId;

  let memberships;
  try {
    const result = await workos.userManagement.listOrganizationMemberships({
      organizationId: orgId,
      statuses: ["active", "inactive"],
    });
    memberships = result.data;
  } catch (error) {
    console.error(
      "[org/members][GET] listOrganizationMemberships failed:",
      "orgId=", orgId,
      "userId=", guard.session.user.id,
      "error=", error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      {
        error: "list_failed",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
  }

  let ownerUserId: string | null = null;
  try {
    ownerUserId = await getOwnerUserId(orgId);
  } catch (error) {
    console.warn(
      "[org/members][GET] getOwnerUserId failed (continuing without owner):",
      error instanceof Error ? error.message : error,
    );
  }

  const users = await fetchUsers(memberships.map((m) => m.userId));

  return NextResponse.json({
    members: memberships.map((m) => {
      const user = users.get(m.userId);
      return {
        id: m.id,
        userId: m.userId,
        email: user?.email ?? null,
        firstName: user?.firstName ?? null,
        lastName: user?.lastName ?? null,
        role: { slug: m.role?.slug ?? null, name: m.role?.slug ?? null },
        status: m.status,
        isOwner: ownerUserId !== null && ownerUserId === m.userId,
        isSelf: m.userId === guard.session.user.id,
        createdAt: m.createdAt,
      };
    }),
    ownerUserId,
  });
}
