/**
 * GET /api/auth/me
 *
 * Returns the current session as JSON for client-side consumption.
 *
 * Used by the `<AuthSessionProvider>` client component (and tests / other
 * fetch-based consumers) to:
 *   1. Determine if the user is signed in.
 *   2. Read the access-token expiry to decide whether to refresh proactively.
 *   3. Get tenant/org info needed for client-rendered UI.
 *
 * Response shape (200):
 *   {
 *     authenticated: true,
 *     user: { id, email, firstName, lastName, profilePictureUrl, emailVerified },
 *     sessionId,
 *     organizationId?,
 *     role?, roles?, permissions?, entitlements?, featureFlags?,
 *     impersonator?,
 *     accessToken,           // included so the client can call the backend
 *     accessTokenExpiresAt,  // unix seconds; client decides when to refresh
 *   }
 *
 * On no session → 401 + { authenticated: false, reason }.
 *
 * SECURITY NOTE: this endpoint only returns the access token, NOT the
 * refresh token. The refresh token never leaves the sealed cookie.
 */

import { NextResponse } from "next/server";
import { decodeJwt } from "jose";

import { getSession } from "@/server/auth/session";

export async function GET() {
  const session = await getSession();

  if (!session.authenticated) {
    return NextResponse.json(
      { authenticated: false, reason: session.reason },
      { status: 401 },
    );
  }

  // Decode the access token *without* verifying — we just need the `exp` so
  // the client can schedule a proactive refresh. The token's signature was
  // already validated by `authenticateWithSessionCookie` inside the helper.
  let accessTokenExpiresAt: number | null = null;
  try {
    const { exp } = decodeJwt(session.accessToken) as { exp?: number };
    accessTokenExpiresAt = typeof exp === "number" ? exp : null;
  } catch {
    accessTokenExpiresAt = null;
  }

  return NextResponse.json(
    {
      authenticated: true,
      user: {
        id: session.user.id,
        email: session.user.email,
        firstName: session.user.firstName ?? null,
        lastName: session.user.lastName ?? null,
        profilePictureUrl: session.user.profilePictureUrl ?? null,
        emailVerified: session.user.emailVerified ?? false,
      },
      sessionId: session.sessionId,
      organizationId: session.organizationId ?? null,
      role: session.role ?? null,
      roles: session.roles ?? null,
      permissions: session.permissions ?? null,
      entitlements: session.entitlements ?? null,
      featureFlags: session.featureFlags ?? null,
      impersonator: session.impersonator ?? null,
      accessToken: session.accessToken,
      accessTokenExpiresAt,
    },
    {
      // Force fresh reads — the client polls this and we never want a
      // stale value sitting in the route handler cache.
      headers: { "cache-control": "no-store, must-revalidate" },
    },
  );
}
