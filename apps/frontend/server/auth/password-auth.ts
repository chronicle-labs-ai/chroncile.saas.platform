import "server-only";

import type { NextRequest } from "next/server";

/*
 * Shared types + helpers for password-based WorkOS authentication.
 *
 * The WorkOS Node SDK doesn't expose `authenticateWithPassword` on its
 * public type surface yet, so each route handler historically declared
 * its own structural type for the call. This module is the single
 * source of truth — both `signup/route.ts` and `login/route.ts` reach
 * for the types here so they stay aligned.
 */

export interface PasswordAuthSessionResult {
  sealedSession?: string;
  organizationId?: string;
  user?: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
  };
}

export interface PasswordAuthenticator {
  authenticateWithPassword(args: {
    clientId: string;
    email: string;
    password: string;
    invitationToken?: string;
    /**
     * Optional WorkOS organization id. When provided, the auth attempt
     * is scoped to that org and WorkOS will not raise
     * `organization_selection_required`. Used to land multi-org users
     * in their primary workspace transparently.
     */
    organizationId?: string;
    ipAddress?: string;
    userAgent?: string;
    session: {
      sealSession: boolean;
      cookiePassword: string;
    };
  }): Promise<PasswordAuthSessionResult>;
}

/**
 * Extract the client's IP from forwarded headers. Falls back to
 * `x-real-ip`, then undefined when neither is set (local dev).
 */
export function getClientIp(request: NextRequest): string | undefined {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || undefined;
  }
  return request.headers.get("x-real-ip") ?? undefined;
}
