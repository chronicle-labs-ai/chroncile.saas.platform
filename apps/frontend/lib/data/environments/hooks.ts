/*
 * React hooks over the environments provider.
 *
 * Read-only — start/stop/exec/stats already proxy through
 * `/api/sandbox/*` directly from the page.
 */

"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import type { SandboxEnvironment } from "ui";

import { useDataProvider } from "../provider";
import { qk } from "../query-keys";

export function useEnvironments(): UseQueryResult<
  readonly SandboxEnvironment[],
  Error
> {
  const { environments } = useDataProvider();
  return useQuery({
    queryKey: qk.environments.list(),
    queryFn: () => environments.list(),
  });
}
