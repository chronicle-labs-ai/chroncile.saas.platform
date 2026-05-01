import { NextResponse } from "next/server";

import { getSession, type AuthenticateResult } from "./session";

export type AuthenticatedSession = Extract<
  AuthenticateResult,
  { authenticated: true }
>;

const ADMIN_LIKE_ROLES = new Set(["admin", "owner"]);

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

  const perms = session.permissions;
  if (Array.isArray(perms) && perms.length > 0) {
    return perms.includes(permission);
  }

  const noRoles =
    !session.role &&
    (!Array.isArray(session.roles) || session.roles.length === 0);
  if (noRoles && permission === "members:read") {
    return true;
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
