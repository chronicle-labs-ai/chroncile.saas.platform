import { decrypt } from "@/lib/encryption";
import type { AgentEndpointConfig as PrismaAgentEndpointConfig } from "@prisma/client";

/** Config with decrypted secret, for building headers and invoking (server-side only). */
export interface AgentConfigResolved {
  endpointUrl: string;
  authType: string;
  authHeaderName: string | null;
  authSecretPlain: string | null;
  basicUsername: string | null;
  customHeaders: Array<{ name: string; value: string }>;
}

/** Resolve DB config: decrypt secret and parse custom headers. Returns null if endpointUrl missing. */
export function resolveAgentConfig(
  row: PrismaAgentEndpointConfig | null
): AgentConfigResolved | null {
  if (!row?.endpointUrl) return null;

  let authSecretPlain: string | null = null;
  if (row.authSecretEncrypted) {
    try {
      authSecretPlain = decrypt(row.authSecretEncrypted);
    } catch {
      authSecretPlain = null;
    }
  }

  let customHeaders: Array<{ name: string; value: string }> = [];
  if (row.customHeadersJson && Array.isArray(row.customHeadersJson)) {
    customHeaders = (row.customHeadersJson as Array<{ name?: string; value?: string }>)
      .filter((h): h is { name: string; value: string } => typeof h?.name === "string" && typeof h?.value === "string")
      .map((h) => ({ name: h.name, value: h.value }));
  }

  return {
    endpointUrl: row.endpointUrl,
    authType: row.authType,
    authHeaderName: row.authHeaderName ?? null,
    authSecretPlain,
    basicUsername: row.basicUsername ?? null,
    customHeaders,
  };
}

/** Build headers for agent request: Content-Type, auth, custom. */
export function buildAgentRequestHeaders(config: AgentConfigResolved): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const { authType, authHeaderName, authSecretPlain, basicUsername, customHeaders } = config;

  if (authSecretPlain) {
    if (authType === "api_key" && authHeaderName) {
      headers[authHeaderName] = authSecretPlain;
    } else if (authType === "bearer") {
      headers["Authorization"] = `Bearer ${authSecretPlain}`;
    } else if (authType === "basic" && basicUsername) {
      headers["Authorization"] = `Basic ${Buffer.from(`${basicUsername}:${authSecretPlain}`).toString("base64")}`;
    }
  }

  for (const { name, value } of customHeaders) {
    if (name) headers[name] = value;
  }

  return headers;
}

const DEFAULT_TIMEOUT_MS = 30_000;

/** Invoke agent endpoint with payload. Returns { ok, status?, data?, error? }. */
export async function invokeAgent(
  config: AgentConfigResolved,
  payload: Record<string, unknown>,
  options?: { timeoutMs?: number }
): Promise<{ ok: boolean; status?: number; data?: unknown; error?: string }> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(config.endpointUrl, {
      method: "POST",
      headers: buildAgentRequestHeaders(config),
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    let data: unknown = null;
    const ct = res.headers.get("content-type");
    if (ct?.includes("application/json")) {
      try {
        data = await res.json();
      } catch {
        data = await res.text();
      }
    } else {
      data = await res.text();
    }

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        data,
        error: `HTTP ${res.status}: ${res.statusText}`,
      };
    }

    return { ok: true, status: res.status, data };
  } catch (err) {
    clearTimeout(timeoutId);
    const message = err instanceof Error ? err.message : String(err);
    const isAbort = (err as { name?: string })?.name === "AbortError";
    return {
      ok: false,
      error: isAbort ? "Request timeout" : message,
    };
  }
}
