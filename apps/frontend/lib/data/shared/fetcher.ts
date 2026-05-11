/*
 * Fetch wrappers used by the `app` and `chronicle` impls.
 *
 *   - `appFetch`       — talks to the host's own Next.js routes
 *                        under `/api/*`. Uses `credentials: "include"`
 *                        so the WorkOS session cookie rides along.
 *   - `chronicleFetch` — talks to the Chronicle Rust backend at
 *                        `NEXT_PUBLIC_BACKEND_URL`. Attaches a
 *                        backend bearer token (minted via
 *                        `/api/auth/backend-token`) and refreshes
 *                        once on 401.
 *
 * Both helpers throw `ProviderError` so domain hooks can branch on
 * `status` (e.g. 404 → empty state, 401 → sign-in prompt).
 */

import { getBackendUrl } from "platform-api";

import { ProviderError } from "../types";
import {
  getBackendToken,
  refreshBackendToken,
} from "./auth-token";

export interface FetchInit {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  searchParams?: Record<string, string | number | boolean | undefined>;
}

function buildUrl(base: string, path: string, init?: FetchInit): string {
  const url = new URL(path, base.endsWith("/") ? base : `${base}/`);
  if (init?.searchParams) {
    for (const [key, value] of Object.entries(init.searchParams)) {
      if (value === undefined) continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as
      | { error?: string; detail?: string; message?: string }
      | null;
    if (body && typeof body === "object") {
      return body.error ?? body.message ?? body.detail ?? res.statusText;
    }
  } catch {
    /* not JSON */
  }
  return res.statusText || `HTTP ${res.status}`;
}

async function readJson<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Hit a Next.js route (`/api/...`) with the WorkOS session cookie. */
export async function appFetch<T>(path: string, init?: FetchInit): Promise<T> {
  const url = path.startsWith("/")
    ? path + buildSearch(init?.searchParams)
    : `/${path}${buildSearch(init?.searchParams)}`;
  const res = await fetch(url, {
    method: init?.method ?? "GET",
    credentials: "include",
    signal: init?.signal,
    headers:
      init?.body !== undefined
        ? { "Content-Type": "application/json" }
        : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) {
    throw new ProviderError(res.status, await readError(res));
  }
  return readJson<T>(res);
}

/** Hit the Chronicle backend with a bearer token. Refreshes once on 401. */
export async function chronicleFetch<T>(
  path: string,
  init?: FetchInit,
): Promise<T> {
  const base = getBackendUrl();
  const url = buildUrl(base, path.startsWith("/") ? path.slice(1) : path, init);

  const doFetch = async (token: string): Promise<Response> =>
    fetch(url, {
      method: init?.method ?? "GET",
      signal: init?.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      credentials: "omit",
    });

  let token = await getBackendToken();
  let res = await doFetch(token);
  if (res.status === 401) {
    token = await refreshBackendToken();
    res = await doFetch(token);
  }
  if (!res.ok) {
    throw new ProviderError(res.status, await readError(res));
  }
  return readJson<T>(res);
}

function buildSearch(
  params?: Record<string, string | number | boolean | undefined>,
): string {
  if (!params) return "";
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    sp.set(key, String(value));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}
