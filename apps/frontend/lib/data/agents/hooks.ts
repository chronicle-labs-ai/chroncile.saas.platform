/*
 * React hooks over the agents provider.
 *
 * Pages call these hooks; the provider stays an implementation
 * detail. Reads use `useQuery`; writes use `useMutation` with
 * `onSuccess` cache patches so live re-renders are immediate
 * (subscribe events fire the same `setQueryData` path through the
 * bridge in `agents/index.ts` for free).
 */

"use client";

import * as React from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import type {
  AgentSnapshot,
  AgentSummary,
  HashDomain,
  HashIndexEntry,
} from "ui";

import { useDataProvider } from "../provider";
import { qk } from "../query-keys";

export function useAgents(): UseQueryResult<readonly AgentSummary[], Error> {
  const { agents } = useDataProvider();
  return useQuery({
    queryKey: qk.agents.list(),
    queryFn: () => agents.list(),
  });
}

export function useAgentSnapshot(
  name: string,
): UseQueryResult<AgentSnapshot | null, Error> {
  const { agents } = useDataProvider();
  return useQuery({
    queryKey: qk.agents.snapshot(name),
    queryFn: () => agents.getSnapshot(name),
    enabled: name.length > 0,
  });
}

export function useHashIndex(
  query: string,
  domains: readonly HashDomain[] = [],
): UseQueryResult<readonly HashIndexEntry[], Error> {
  const { agents } = useDataProvider();
  return useQuery({
    queryKey: qk.agents.hashIndex(query, domains),
    queryFn: () => agents.searchHashIndex(query, domains),
  });
}

export function usePinLatestAgent(): UseMutationResult<
  AgentSummary,
  Error,
  string
> {
  const { agents } = useDataProvider();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => agents.pinLatest(name),
    onSuccess: (next) => {
      qc.setQueryData(qk.agents.list(), (old?: readonly AgentSummary[]) => {
        if (!old) return [next];
        const without = old.filter((a) => a.name !== next.name);
        return [next, ...without] as readonly AgentSummary[];
      });
      qc.invalidateQueries({ queryKey: qk.agents.snapshot(next.name) });
    },
  });
}

/**
 * Imperative escape hatch — returns a stable callback that flips the
 * pinned agent and awaits the mutation. Useful for `<AgentsManager />`
 * which expects a `(name: string) => Promise<void>` shape.
 */
export function usePinLatestAgentAction(): (name: string) => Promise<void> {
  const mutation = usePinLatestAgent();
  return React.useCallback(
    async (name: string) => {
      await mutation.mutateAsync(name);
    },
    [mutation],
  );
}
