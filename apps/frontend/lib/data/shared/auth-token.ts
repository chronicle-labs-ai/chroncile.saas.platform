/*
 * Client-side bearer-token cache for the `chronicle` impls.
 *
 * Tokens are minted by the Next.js route at
 * `/api/auth/backend-token`, which delegates to the existing
 * server-side `getBackendToken` helper — that's where the
 * `SERVICE_SECRET` lives, and that's where it stays.
 *
 * The cache holds a single token in module memory: the chronicle
 * impl is per-tab + per-tenant, and the route handler implicitly
 * scopes by the WorkOS session. We refresh proactively two minutes
 * before expiry, and reactively on a 401 (see `fetcher.ts`).
 */

interface CachedToken {
  token: string;
  expiresAt: number;
}

interface BackendTokenResponse {
  token?: string;
  expiresAt?: string;
}

const REFRESH_LEAD_MS = 2 * 60_000;
const TOKEN_ENDPOINT = "/api/auth/backend-token";

let cached: CachedToken | null = null;
let inflight: Promise<string> | null = null;

async function mint(): Promise<string> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "GET",
    credentials: "include",
    headers: { "cache-control": "no-store" },
  });
  if (!res.ok) {
    cached = null;
    throw new Error(
      `[auth-token] /api/auth/backend-token returned ${res.status}`,
    );
  }
  const body = (await res.json()) as BackendTokenResponse;
  if (!body.token) {
    throw new Error("[auth-token] response missing token");
  }
  const expiresAt = body.expiresAt
    ? Date.parse(body.expiresAt)
    : Date.now() + 23 * 60 * 60_000;
  cached = { token: body.token, expiresAt };
  return body.token;
}

/**
 * Return a valid backend token, minting / refreshing as needed.
 * Concurrent callers share the in-flight request so we never make
 * more than one call per tab when bursts of queries fire on first
 * paint.
 */
export async function getBackendToken(): Promise<string> {
  if (cached && cached.expiresAt - REFRESH_LEAD_MS > Date.now()) {
    return cached.token;
  }
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      return await mint();
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/**
 * Forget the cached token and mint a fresh one. Called by the
 * fetcher on 401 to recover from server-side invalidation
 * (e.g. tenant switched, token expired earlier than expected).
 */
export async function refreshBackendToken(): Promise<string> {
  cached = null;
  return getBackendToken();
}

/** Clear the cache without refetching. Used on sign-out. */
export function clearBackendToken(): void {
  cached = null;
  inflight = null;
}
