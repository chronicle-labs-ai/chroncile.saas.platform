/*
 * React hooks over the connections provider.
 *
 * The dashboard's `<ConnectionsManager />` accepts a wide handler
 * surface (pause / resume / test / reauth / rotate / backfill /
 * disconnect / subscribe). Each handler is a one-line `useMutation`
 * wrapper — TanStack Query owns the pending state, retry policy,
 * and `onSuccess` cache patch.
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
  Connection,
  ConnectionBackfillRecord,
  ConnectionDelivery,
  ConnectionEventTypeSub,
} from "chronicle/types/connections";

import { useDataProvider } from "../provider";
import { qk } from "../query-keys";

export function useConnections(): UseQueryResult<readonly Connection[], Error> {
  const { connections } = useDataProvider();
  return useQuery({
    queryKey: qk.connections.list(),
    queryFn: () => connections.list(),
  });
}

export function useConnectionBackfills(): UseQueryResult<
  Readonly<Record<string, readonly ConnectionBackfillRecord[]>>,
  Error
> {
  const { connections } = useDataProvider();
  return useQuery({
    queryKey: qk.connections.backfills(),
    queryFn: () => connections.listBackfills(),
  });
}

export function useConnectionDeliveries(): UseQueryResult<
  Readonly<Record<string, readonly ConnectionDelivery[]>>,
  Error
> {
  const { connections } = useDataProvider();
  return useQuery({
    queryKey: qk.connections.deliveries(),
    queryFn: () => connections.listDeliveries(),
  });
}

export function useConnectionEventSubs(): UseQueryResult<
  Readonly<Record<string, readonly ConnectionEventTypeSub[]>>,
  Error
> {
  const { connections } = useDataProvider();
  return useQuery({
    queryKey: qk.connections.eventSubs(),
    queryFn: () => connections.listEventSubs(),
  });
}

/* ── Action mutations ───────────────────────────────────── */

type ConnectionAction = (id: string) => Promise<Connection>;

function useRowMutation(
  fn: (provider: ReturnType<typeof useDataProvider>["connections"]) => ConnectionAction,
): UseMutationResult<Connection, Error, string> {
  const { connections } = useDataProvider();
  const action = fn(connections);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => action(id),
    onSuccess: (next) => {
      qc.setQueryData(qk.connections.list(), (old?: readonly Connection[]) =>
        old
          ? (old.map((c) => (c.id === next.id ? next : c)) as readonly Connection[])
          : ([next] as readonly Connection[]),
      );
    },
  });
}

export const usePauseConnection = () =>
  useRowMutation((c) => (id) => c.pause(id));
export const useResumeConnection = () =>
  useRowMutation((c) => (id) => c.resume(id));
export const useTestConnection = () =>
  useRowMutation((c) => (id) => c.test(id));
export const useReauthConnection = () =>
  useRowMutation((c) => (id) => c.reauth(id));
export const useRotateConnectionSecret = () =>
  useRowMutation((c) => (id) => c.rotateSecret(id));
export const useRunConnectionBackfill = () =>
  useRowMutation((c) => (id) => c.runBackfill(id));

export function useDisconnectConnection(): UseMutationResult<
  void,
  Error,
  string
> {
  const { connections } = useDataProvider();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => connections.disconnect(id),
    onSuccess: (_void, id) => {
      qc.setQueryData(qk.connections.list(), (old?: readonly Connection[]) =>
        old
          ? (old.filter((c) => c.id !== id) as readonly Connection[])
          : old,
      );
    },
  });
}

/* ── Action-shape adapters for the manager's handler props ─ */

function asAction(
  mutation: UseMutationResult<unknown, Error, string>,
): (id: string) => Promise<void> {
  return React.useCallback(
    async (id: string) => {
      await mutation.mutateAsync(id);
    },
    [mutation],
  );
}

export function usePauseConnectionAction() {
  return asAction(usePauseConnection());
}
export function useResumeConnectionAction() {
  return asAction(useResumeConnection());
}
export function useTestConnectionAction() {
  return asAction(useTestConnection());
}
export function useReauthConnectionAction() {
  return asAction(useReauthConnection());
}
export function useRotateConnectionSecretAction() {
  return asAction(useRotateConnectionSecret());
}
export function useRunConnectionBackfillAction() {
  return asAction(useRunConnectionBackfill());
}
export function useDisconnectConnectionAction() {
  return asAction(useDisconnectConnection());
}
