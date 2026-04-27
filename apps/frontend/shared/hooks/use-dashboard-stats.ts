import type { DashboardStatsResponse } from "shared/generated";
import { useApiSwr } from "@/shared/hooks/use-api-swr";

export function useDashboardStats() {
  const { data, error, isLoading, mutate } = useApiSwr<DashboardStatsResponse>(
    "/api/platform/dashboard/stats",
    {
      revalidateOnFocus: true,
      refreshInterval: 10000,
    }
  );

  return {
    eventsCount: data?.totalRuns ?? 0,
    connectionsCount: data?.totalConnections ?? 0,
    eventsTodayCount: data?.completedRuns ?? 0,
    sessionsCount: data?.activeConnections ?? 0,
    runsCount: data?.totalRuns ?? 0,
    runsTodayCount: data?.pendingRuns ?? 0,
    isLoading,
    error,
    mutate,
  };
}
