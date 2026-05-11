/*
 * React hooks over the backtests provider.
 *
 * Pages call these hooks; the provider stays an implementation
 * detail. All three hooks are read-only — Backtests has no mutation
 * surface today.
 */

"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import type { BacktestRunSummary } from "ui";

import { useDataProvider } from "../provider";
import { qk } from "../query-keys";
import type { BacktestsAvailability, BacktestsScene } from "./types";

export function useBacktestsRuns(): UseQueryResult<
  readonly BacktestRunSummary[],
  Error
> {
  const { backtests } = useDataProvider();
  return useQuery({
    queryKey: qk.backtests.list(),
    queryFn: () => backtests.listRuns(),
  });
}

export function useBacktestsAvailability(): UseQueryResult<
  BacktestsAvailability,
  Error
> {
  const { backtests } = useDataProvider();
  return useQuery({
    queryKey: qk.backtests.availability(),
    queryFn: () => backtests.getAvailability(),
  });
}

export function useBacktestsScene(): UseQueryResult<
  BacktestsScene | null,
  Error
> {
  const { backtests } = useDataProvider();
  return useQuery({
    queryKey: qk.backtests.scene(),
    queryFn: () => backtests.getInitialScene(),
  });
}
