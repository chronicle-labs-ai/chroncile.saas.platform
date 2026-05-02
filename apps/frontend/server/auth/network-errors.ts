/*
 * Detects transient network errors thrown by the WorkOS SDK or any
 * other server-side `fetch` so the proxy / `auth()` / `getSession()`
 * helpers can degrade gracefully instead of crashing the request.
 *
 * The WorkOS SDK verifies session JWTs against the JWKS endpoint at
 * `api.workos.com` and refreshes tokens against the same host. When
 * the dev machine is offline (laptop on a plane, VPN dropping, DNS
 * outage, etc.) those calls throw `TypeError: fetch failed` with a
 * Node `cause` of `ENOTFOUND`, `ECONNREFUSED`, or `ETIMEDOUT`. Without
 * a dedicated catch, the throw escapes the request boundary and
 * Next.js renders a 404 (no `error.tsx`) — confusing for the developer
 * and for end users.
 *
 * `isNetworkError` walks the error / cause chain and answers a single
 * boolean. Use it to decide whether to redirect to the login page with
 * a friendly banner (`?error=auth_unreachable`) and, importantly, to
 * keep the session cookie intact so the user is automatically signed
 * back in once connectivity returns.
 */

export const NETWORK_ERROR_CODES = new Set([
  "ENOTFOUND",
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
  "UND_ERR_CLOSED",
]);

export const NETWORK_ERROR_MESSAGES = [
  "fetch failed",
  "network request failed",
  "getaddrinfo",
  "request timed out",
];

interface NodeishError {
  name?: string;
  message?: string;
  code?: string;
  errno?: number;
  cause?: unknown;
}

function looksLikeNodeishError(value: unknown): value is NodeishError {
  return Boolean(value) && typeof value === "object";
}

/**
 * True when the error (or any error in its `cause` chain) represents a
 * recoverable network condition. Walks up to four levels of `cause`
 * because Node `fetch` wraps `errno`-style errors twice.
 */
export function isNetworkError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current != null; depth++) {
    if (!looksLikeNodeishError(current)) return false;

    if (typeof current.code === "string" && NETWORK_ERROR_CODES.has(current.code)) {
      return true;
    }

    if (typeof current.message === "string") {
      const lower = current.message.toLowerCase();
      if (NETWORK_ERROR_MESSAGES.some((needle) => lower.includes(needle))) {
        return true;
      }
    }

    current = current.cause;
  }
  return false;
}

/**
 * One-line, redacted summary suitable for `console.warn` so we never
 * spam the dev console with the same multi-line WorkOS stack on every
 * request while the network is still down.
 */
export function summarizeNetworkError(error: unknown): string {
  if (!looksLikeNodeishError(error)) return String(error);
  const code =
    typeof error.code === "string"
      ? error.code
      : looksLikeNodeishError(error.cause) && typeof error.cause.code === "string"
        ? error.cause.code
        : "unknown";
  const host =
    typeof error.message === "string" && /enotfound\s+([^\s]+)/i.exec(error.message)?.[1];
  return host ? `${code} (${host})` : code;
}
