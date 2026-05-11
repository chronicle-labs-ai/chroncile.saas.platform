import { NextResponse } from "next/server";

import { auth } from "@/server/auth/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * Mints a backend bearer token the browser-side `chronicle` data
 * provider can use to talk directly to `chronicle-backend`.
 *
 * What we hand out is the active WorkOS access token from the
 * sealed session — that's what the Chronicle backend's
 * `WorkosJwtVerifier` already accepts. The `SERVICE_SECRET`
 * exchange path is reserved for server-side proxies and never
 * leaves the server.
 *
 * The response also reports `expiresAt` (extracted from the JWT
 * `exp` claim) so the client can refresh proactively before the
 * token goes stale.
 */

interface TokenResponse {
  token: string;
  expiresAt: string;
}

function readJwtExpiry(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payloadJson =
      typeof atob === "function"
        ? atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
        : Buffer.from(parts[1], "base64url").toString("utf8");
    const claims = JSON.parse(payloadJson) as { exp?: number };
    if (typeof claims.exp === "number") return claims.exp * 1000;
  } catch {
    /* malformed token — fall through to default expiry */
  }
  return null;
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const token = session.backendToken;
  if (!token) {
    return NextResponse.json(
      { error: "no_backend_token" },
      { status: 502 },
    );
  }

  /* Default: assume ~10m of life so the client refreshes
     periodically even if the JWT is opaque. */
  const expMs = readJwtExpiry(token) ?? Date.now() + 10 * 60_000;

  const body: TokenResponse = {
    token,
    expiresAt: new Date(expMs).toISOString(),
  };

  return NextResponse.json(body, {
    headers: {
      "cache-control": "no-store",
    },
  });
}
