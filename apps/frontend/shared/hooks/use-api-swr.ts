"use client";

import useSWR, { type SWRConfiguration, type SWRResponse } from "swr";
import { useSession } from "next-auth/react";
import { getBackendUrl } from "platform-api";

const BACKEND_URL = getBackendUrl();

function buildFetcher(token: string | undefined) {
  return async <T>(path: string): Promise<T> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`${BACKEND_URL}${path}`, {
      headers,
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({
        error: res.statusText,
      }));
      throw new Error(err.error || `Request failed: ${res.status}`);
    }

    return res.json();
  };
}

export function useApiSwr<T>(
  path: string | null,
  config?: SWRConfiguration<T>
): SWRResponse<T> {
  const { data: session } = useSession();
  const token = session?.backendToken;
  const fetcher = buildFetcher(token);

  return useSWR<T>(token && path ? path : null, fetcher, config);
}
