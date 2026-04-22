"use client";

import useSWR from "swr";
import { fetcher } from "@/shared/fetcher";
import type {
  ContainerStatus,
  MigrationStatus,
  DbInfo,
} from "@/lib/local-db";
import { ContainerPanel } from "./container-panel";
import { MigrationsPanel } from "./migrations-panel";
import { SeedsPanel } from "./seeds-panel";
import { BackendPanel } from "./backend-panel";

interface LocalDbStatus {
  dockerAvailable: boolean;
  dockerError: string | null;
  container: ContainerStatus;
  migrations: MigrationStatus | null;
  dbInfo: DbInfo | null;
  backendPid: number | null;
  backendHealthy: boolean;
  databaseUrl: string;
}

export function DatabaseTab() {
  const { data, isLoading, mutate } = useSWR<LocalDbStatus>(
    "/api/local-db",
    fetcher,
    { refreshInterval: 5_000 },
  );

  const onRefresh = () => mutate();

  if (isLoading || !data) {
    return (
      <div className="text-secondary text-sm font-mono py-4">
        Loading local database status...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!data.dockerAvailable && (
        <div className="panel border-[var(--critical-dim)]">
          <div className="panel__header bg-[var(--critical-bg)]">
            <div className="flex items-center gap-2">
              <span className="status-dot status-dot--critical" />
              <span className="panel__title text-critical">Docker Not Available</span>
            </div>
          </div>
          <div className="panel__content bg-[var(--critical-bg)] space-y-3">
            <p className="text-sm text-critical/90">{data.dockerError}</p>
            <div className="text-xs text-secondary space-y-1">
              <p className="font-medium text-primary">To fix:</p>
              <ol className="list-decimal list-inside space-y-1 text-secondary">
                <li>Open <span className="font-mono text-primary">Docker Desktop</span> from Applications, or run <code className="font-mono text-data bg-[var(--bg-hover)] px-1.5 py-0.5 rounded">open -a Docker</code></li>
                <li>Wait for the Docker engine to start (whale icon in menu bar stops animating)</li>
                <li>This page will automatically detect Docker once it is running</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      <ContainerPanel
        container={data.container}
        dbInfo={data.dbInfo}
        databaseUrl={data.databaseUrl}
        dockerAvailable={data.dockerAvailable}
        onRefresh={onRefresh}
      />

      <MigrationsPanel
        migrations={data.migrations}
        pgReady={data.container.pgReady}
        onRefresh={onRefresh}
      />

      <SeedsPanel
        pgReady={data.container.pgReady}
        onRefresh={onRefresh}
      />

      <BackendPanel
        backendPid={data.backendPid}
        backendHealthy={data.backendHealthy}
        databaseUrl={data.databaseUrl}
        onRefresh={onRefresh}
      />
    </div>
  );
}
