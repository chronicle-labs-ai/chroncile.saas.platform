/**
 * GET  /api/auth/refresh?return_to=...
 * POST /api/auth/refresh
 *
 * Refreshes the WorkOS sealed session via the doc-canonical helper:
 *
 *   const session = await workos.userManagement.loadSealedSession({...});
 *   const result = await session.refresh();
 *   if (result.authenticated) cookies.set("wos-session", result.sealedSession);
 *
 * The SDK's `session.refresh()` does the unseal → exchange → re-seal cycle
 * atomically and returns a typed `reason` on failure (`invalid_grant`,
 * `mfa_enrollment`, `sso_required`, etc.) — no manual error walking.
 *
 * Concurrent-refresh dedup: refresh tokens are single-use per the doc
 * ("Refresh tokens may only be used once"). When two callers race for the
 * same cookie, only the first wins; the rest receive `invalid_grant`. We
 * dedupe in-process via a `Map<sessionData, Promise>` keyed by the sealed
 * cookie value so paralle requests within the same Node process share a
 * single round-trip.
 *
 * Status codes:
 *   GET success                   → 302 to `return_to` (or `/dashboard`)
 *   GET failure (auth)            → 302 to `/login?error=...`
 *   GET failure (transient)       → 302 to `return_to` (caller retries)
 *   POST success                  → 200 + { ok: true }
 *   POST failure (auth)           → 401 + { error }
 *   POST failure (transient)      → 503 + { error }
 *
 * Docs:
 *   https://workos.com/docs/reference/authkit/session-helpers#refresh
 *   https://workos.com/docs/reference/authkit/session-tokens#refresh-token
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";

import {
  clearSession,
  loadSession,
  RefreshResult,
  SESSION_COOKIE_NAME,
  setSealedSession,
} from "@/server/auth/session";

const TRANSIENT_NETWORK_CODES = new Set([
  "EAGAIN",
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EPIPE",
]);

const AUTH_FAILURE_REASONS = new Set([
  "invalid_grant",
  "mfa_enrollment",
  "sso_required",
  "invalid_session_cookie",
  "no_session_cookie_provided",
]);

function isTransientNetworkError(err: unknown): boolean {
  let cur: unknown = err;
  while (cur && typeof cur === "object") {
    const code = (cur as { code?: unknown }).code;
    if (typeof code === "string" && TRANSIENT_NETWORK_CODES.has(code)) {
      return true;
    }
    const errors = (cur as { errors?: unknown[] }).errors;
    if (Array.isArray(errors)) {
      for (const sub of errors) {
        if (sub && typeof sub === "object") {
          const subCode = (sub as { code?: unknown }).code;
          if (
            typeof subCode === "string" &&
            TRANSIENT_NETWORK_CODES.has(subCode)
          ) {
            return true;
          }
        }
      }
    }
    cur = (cur as { cause?: unknown }).cause;
  }
  return false;
}

function safeReturnTo(value: string | null | undefined): string {
  if (typeof value !== "string") return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

/**
 * In-process dedup of concurrent refresh attempts for the same cookie.
 * Refresh tokens are single-use, so we coalesce multiple requests in flight
 * (multi-tab, parallel SWR fetches, etc.) onto one underlying refresh.
 */
const inFlight = new Map<string, Promise<RefreshResult>>();

interface RefreshOk {
  ok: true;
}
interface RefreshFail {
  ok: false;
  status: 401 | 503;
  reason: string;
}

async function performRefresh(): Promise<RefreshOk | RefreshFail> {
  const cookieStore = await cookies();
  const sessionData = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionData) {
    return { ok: false, status: 401, reason: "no_cookie" };
  }

  // Coalesce parallel refreshes against the SAME cookie value.
  let promise = inFlight.get(sessionData);
  if (!promise) {
    promise = (async () => {
      const session = await loadSession();
      if (!session) {
        return {
          authenticated: false as const,
          reason: "no_cookie",
        };
      }
      return session.refresh();
    })().finally(() => {
      inFlight.delete(sessionData);
    });
    inFlight.set(sessionData, promise);
  }

  let result: RefreshResult;
  try {
    result = await promise;
  } catch (error) {
    if (isTransientNetworkError(error)) {
      console.warn(
        "[auth/refresh] transient failure",
        error instanceof Error ? error.message : error,
      );
      return { ok: false, status: 503, reason: "transient_failure" };
    }
    console.error(
      "[auth/refresh] unknown failure (keeping session)",
      error instanceof Error ? error.message : error,
    );
    return { ok: false, status: 503, reason: "unknown_failure" };
  }

  if (!result.authenticated) {
    if (AUTH_FAILURE_REASONS.has(result.reason)) {
      console.warn("[auth/refresh] auth failure:", result.reason);
      await clearSession();
      return { ok: false, status: 401, reason: result.reason };
    }
    // Unknown reason — be conservative, keep the cookie.
    console.warn("[auth/refresh] non-auth failure:", result.reason);
    return { ok: false, status: 503, reason: result.reason };
  }

  await setSealedSession(result.sealedSession);
  return { ok: true };
}

export async function GET(request: NextRequest) {
  const result = await performRefresh();
  const returnTo = safeReturnTo(
    request.nextUrl.searchParams.get("return_to"),
  );

  if (result.ok) redirect(returnTo);

  if (result.status === 401) {
    redirect(`/login?error=${encodeURIComponent(result.reason)}`);
  }

  // Transient — bounce back; caller can retry.
  redirect(returnTo);
}

export async function POST() {
  const result = await performRefresh();
  if (result.ok) return NextResponse.json({ ok: true });
  return NextResponse.json(
    { error: result.reason },
    { status: result.status },
  );
}
