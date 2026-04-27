"use client";

import useSWR from "swr";
import { fetcher } from "@/shared/fetcher";

interface ServiceProbe {
  name: string;
  status: string;
  latencyMs: number;
  error?: string;
}

interface ProcessMetrics {
  pid: number;
  uptimeSecs: number;
  memoryBytes: number | null;
  numThreads: number | null;
}

interface BackendMetrics {
  process: ProcessMetrics;
  services: ServiceProbe[];
  version: string;
  gitSha?: string;
}

function formatUptime(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ${secs % 60}s`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function serviceStatusDot(status: string): string {
  if (status === "up") return "status-dot--nominal";
  if (status === "unconfigured") return "status-dot--offline";
  return "status-dot--critical";
}

export function LocalResourcePanel() {
  const { data, isLoading } = useSWR<BackendMetrics>(
    "/api/local-db/metrics",
    fetcher,
    { refreshInterval: 5_000 }
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="panel">
              <div className="panel__content h-20 animate-pulse bg-elevated rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data || !data.process) {
    return (
      <div className="panel">
        <div className="panel__content text-center py-8">
          <p className="text-sm text-secondary">
            Backend not reachable or metrics endpoint not available
          </p>
          <p className="text-xs text-tertiary mt-1">
            Restart the backend to pick up the new /api/platform/metrics
            endpoint
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="panel">
        <div className="panel__header">
          <div className="flex items-center gap-2">
            <span className="panel__title">Backend Process</span>
            <span className="badge badge--data font-mono">v{data.version}</span>
          </div>
          {data.gitSha && (
            <span className="font-mono text-[10px] text-tertiary">
              {data.gitSha.slice(0, 7)}
            </span>
          )}
        </div>
        <div className="panel__content">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="metric">
                <span className="metric__label">PID</span>
                <span className="metric__value metric__value--data text-xl">
                  {data.process.pid}
                </span>
              </div>
            </div>
            <div>
              <div className="metric">
                <span className="metric__label">Uptime</span>
                <span className="metric__value metric__value--data text-xl">
                  {formatUptime(data.process.uptimeSecs)}
                </span>
              </div>
            </div>
            <div>
              <div className="metric">
                <span className="metric__label">Memory (RSS)</span>
                <span className="metric__value metric__value--data text-xl">
                  {data.process.memoryBytes
                    ? formatBytes(data.process.memoryBytes)
                    : "—"}
                </span>
              </div>
            </div>
            <div>
              <div className="metric">
                <span className="metric__label">Threads</span>
                <span className="metric__value metric__value--data text-xl">
                  {data.process.numThreads ?? "—"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel__header">
          <span className="panel__title">Service Health</span>
        </div>
        <div className="panel__content">
          <div className="divide-y divide-border-dim">
            {data.services.map((svc) => (
              <div
                key={svc.name}
                className="flex items-center justify-between py-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`status-dot ${serviceStatusDot(svc.status)}`}
                  />
                  <span className="font-mono text-sm text-primary">
                    {svc.name}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  {svc.error && (
                    <span className="text-xs text-critical font-mono truncate max-w-[200px]">
                      {svc.error}
                    </span>
                  )}
                  <span className="font-mono text-xs text-tertiary">
                    {svc.latencyMs}ms
                  </span>
                  <span
                    className={`font-mono text-xs ${
                      svc.status === "up"
                        ? "text-nominal"
                        : svc.status === "unconfigured"
                          ? "text-tertiary"
                          : "text-critical"
                    }`}
                  >
                    {svc.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
