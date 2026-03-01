/**
 * Service-to-service client for the Chronicle Rust backend.
 * Uses SERVICE_SECRET + token-exchange to authenticate requests.
 */

const SERVICE_SECRET = process.env.SERVICE_SECRET ?? "";
const SERVICE_USER_ID = process.env.SERVICE_USER_ID ?? "env-manager-service-account";

let cachedTokens: Map<string, { token: string; expiresAt: number }> = new Map();

async function getServiceToken(backendUrl: string): Promise<string | null> {
  const cacheKey = backendUrl;
  const cached = cachedTokens.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }

  try {
    const res = await fetch(`${backendUrl}/api/platform/auth/token-exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_secret: SERVICE_SECRET,
        user_id: SERVICE_USER_ID,
        email: "admin@chronicle-labs.com",
        name: "Env Manager",
        tenant_id: SERVICE_USER_ID,
        tenant_name: "Chronicle Labs",
        tenant_slug: "chronicle-labs",
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const { token } = await res.json();
    if (!token) return null;

    cachedTokens.set(cacheKey, {
      token,
      expiresAt: Date.now() + 23 * 60 * 60 * 1000,
    });
    return token;
  } catch {
    return null;
  }
}

// Fly machines cold-start can take 30-45s; use a generous timeout
const TIMEOUT_MS = 45_000;

export async function backendFetch(
  backendUrl: string,
  path: string,
  init?: RequestInit
): Promise<Response> {
  // Try x-service-secret first (new admin endpoints, available after latest deploy)
  let adminRes: Response | null = null;
  try {
    adminRes = await fetch(`${backendUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "x-service-secret": SERVICE_SECRET,
        ...init?.headers,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (adminRes.ok) return adminRes;
    // 404 = endpoint not deployed yet; 401 = wrong secret → fall through to JWT
    if (adminRes.status !== 404 && adminRes.status !== 401 && adminRes.status !== 403) {
      return adminRes;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Backend unreachable at ${backendUrl} — ${msg}. The machine may be starting up; try again in a moment.`);
  }

  // Fall back to JWT-based auth (works on all deployed backends)
  const token = await getServiceToken(backendUrl);
  if (!token) {
    // If we got a 404 from the admin endpoint, surface a helpful message
    if (adminRes?.status === 404) {
      throw new Error("Admin endpoint not available — backend may need to be redeployed with the latest code");
    }
    throw new Error("Could not obtain service token — check SERVICE_SECRET");
  }

  return fetch(`${backendUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}
