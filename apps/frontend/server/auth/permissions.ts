import { NextResponse } from "next/server";

import { getSession, type AuthenticateResult } from "./session";

export type AuthenticatedSession = Extract<
  AuthenticateResult,
  { authenticated: true }
>;

const ADMIN_LIKE_ROLES = new Set(["admin", "owner"]);

const OPEN_TO_ANY_MEMBER = new Set(["members:read"]);

function hasAdminLikeRole(session: AuthenticatedSession): boolean {
  if (typeof session.role === "string" && ADMIN_LIKE_ROLES.has(session.role.toLowerCase())) {
    return true;
  }
  if (Array.isArray(session.roles)) {
    for (const r of session.roles) {
      if (typeof r === "string" && ADMIN_LIKE_ROLES.has(r.toLowerCase())) {
        return true;
      }
    }
  }
  return false;
}

export function hasPermission(
  session: AuthenticatedSession,
  permission: string,
): boolean {
  if (hasAdminLikeRole(session)) return true;

  // Any authenticated member of the active org can read membership.
  if (OPEN_TO_ANY_MEMBER.has(permission)) return true;

  const perms = session.permissions;
  if (Array.isArray(perms) && perms.length > 0) {
    return perms.includes(permission);
  }

  return false;
}

export async function requirePermission(
  permission: string,
): Promise<
  | { session: AuthenticatedSession; response?: undefined }
  | { session?: undefined; response: NextResponse }
> {
  const session = await getSession();
  if (!session.authenticated) {
    return {
      response: NextResponse.json(
        { error: "unauthenticated" },
        { status: 401 },
      ),
    };
  }

  if (!hasPermission(session, permission)) {
    return {
      response: NextResponse.json(
        { error: "forbidden", required: permission },
        { status: 403 },
      ),
    };
  }

  return { session };
}

export async function requireSession(): Promise<
  | { session: AuthenticatedSession; response?: undefined }
  | { session?: undefined; response: NextResponse }
> {
  const session = await getSession();
  if (!session.authenticated) {
    return {
      response: NextResponse.json(
        { error: "unauthenticated" },
        { status: 401 },
      ),
    };
  }
  return { session };
}
