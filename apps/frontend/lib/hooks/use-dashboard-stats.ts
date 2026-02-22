import useSWR from "swr";

export interface DashboardStats {
  eventsCount: number;
  connectionsCount: number;
  eventsTodayCount: number;
  sessionsCount: number;
  runsCount: number;
  runsTodayCount: number;
}

const fetcher = async (url: string): Promise<DashboardStats> => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch dashboard stats");
  const data = await res.json();
  return {
    eventsCount: data.eventsCount ?? 0,
    connectionsCount: data.connectionsCount ?? 0,
    eventsTodayCount: data.eventsTodayCount ?? 0,
    sessionsCount: data.sessionsCount ?? 0,
    runsCount: data.runsCount ?? 0,
    runsTodayCount: data.runsTodayCount ?? 0,
  };
};

export function useDashboardStats() {
  const { data, error, isLoading, mutate } = useSWR<DashboardStats>(
    "/api/dashboard/stats",
    fetcher,
    {
      revalidateOnFocus: true,
      refreshInterval: 10000,
    }
  );

  return {
    eventsCount: data?.eventsCount ?? 0,
    connectionsCount: data?.connectionsCount ?? 0,
    eventsTodayCount: data?.eventsTodayCount ?? 0,
    sessionsCount: data?.sessionsCount ?? 0,
    runsCount: data?.runsCount ?? 0,
    runsTodayCount: data?.runsTodayCount ?? 0,
    isLoading,
    error,
    mutate,
  };
}
