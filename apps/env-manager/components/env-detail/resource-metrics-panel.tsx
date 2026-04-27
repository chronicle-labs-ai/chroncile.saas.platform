"use client";

import { useState } from "react";
import useSWR from "swr";
import type {
  ResourcesData,
  MetricsData,
  TimeWindow,
  HealthCheckRecord,
} from "@/shared/types";
import { fetcher } from "@/shared/fetcher";
import { MetricCard } from "@/shared/components/metric-chart";

// ── Constants ────────────────────────────────────────────────────────────────

const TIME_WINDOWS: { id: TimeWindow; label: string }[] = [
  { id: "30m", label: "30m" },
  { id: "1h", label: "1h" },
  { id: "6h", label: "6h" },
  { id: "24h", label: "24h" },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes.toFixed(0)} B/s`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB/s`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB/s`;
}

// ── Utilization Charts ───────────────────────────────────────────────────────

function UtilizationPanel({ envId }: { envId: string }) {
  const [window, setWindow] = useState<TimeWindow>("1h");

  const { data, isLoading } = useSWR<MetricsData>(
    `/api/environments/${envId}/metrics?window=${window}`,
    fetcher,
    { refreshInterval: 1_000 }
  );

  const hasData =
    data &&
    ((data.cpu?.series?.length ?? 0) > 0 ||
      (data.memory?.series?.length ?? 0) > 0 ||
      (data.disk?.series?.length ?? 0) > 0 ||
      (data.requests?.series?.length ?? 0) > 0);

  return (
    <div className="panel">
      <div className="panel__header">
        <div className="flex items-center gap-2">
          <span className="panel__title">Live Utilization</span>
          {isLoading && (
            <div className="w-3 h-3 rounded-full border-2 border-border-bright border-t-data animate-spin" />
          )}
        </div>
        <div className="flex items-center gap-1 bg-elevated border border-border-dim rounded-sm p-0.5">
          {TIME_WINDOWS.map((tw) => (
            <button
              key={tw.id}
              onClick={() => setWindow(tw.id)}
              className={`px-2.5 py-1 text-[10px] font-mono rounded-sm transition-colors ${
                window === tw.id
                  ? "bg-data-bg text-data border border-data-dim"
                  : "text-tertiary hover:text-secondary border border-transparent"
              }`}
            >
              {tw.label}
            </button>
          ))}
        </div>
      </div>

      {!hasData && !isLoading ? (
        <div className="panel__content text-center py-8">
          <p className="text-xs text-tertiary font-mono">
            No metrics data available for this window
          </p>
          <p className="text-[10px] text-disabled mt-1">
            Metrics appear once the machine has been running for a few minutes
          </p>
        </div>
      ) : (
        <div className="panel__content">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <MetricCard
              title="CPU"
              current={data?.cpu.current ?? null}
              unit="%"
              series={data?.cpu.series ?? []}
              color="#00d4ff"
              yMax={100}
            />
            <MetricCard
              title="Memory"
              current={data?.memory.current ?? null}
              unit="%"
              series={data?.memory.series ?? []}
              color="#a78bfa"
              yMax={100}
            />
            <MetricCard
              title="Disk"
              current={data?.disk.current ?? null}
              unit="%"
              series={data?.disk.series ?? []}
              color="#f59e0b"
              yMax={100}
            />
            <MetricCard
              title="Requests"
              current={data?.requests.current ?? null}
              unit="req/s"
              series={data?.requests.series ?? []}
              color="#34d399"
              formatValue={(v) =>
                v < 1
                  ? v.toFixed(2)
                  : v < 100
                    ? v.toFixed(1)
                    : Math.round(v).toString()
              }
            />
            <MetricCard
              title="Net In"
              current={data?.netIn.current ?? null}
              unit=""
              series={data?.netIn.series ?? []}
              color="#60a5fa"
              formatValue={formatBytes}
            />
            <MetricCard
              title="Net Out"
              current={data?.netOut.current ?? null}
              unit=""
              series={data?.netOut.series ?? []}
              color="#fb923c"
              formatValue={formatBytes}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Service Status Badge ─────────────────────────────────────────────────────

function ServiceBadge({
  name,
  status,
}: {
  name: string;
  status: { status: string; latencyMs?: number; error?: string };
}) {
  const dotClass =
    status.status === "up"
      ? "status-dot--nominal"
      : status.status === "down"
        ? "status-dot--critical"
        : "status-dot--offline";

  return (
    <span
      className="inline-flex items-center gap-1 font-mono text-[10px]"
      title={status.error ? `${name}: ${status.error}` : name}
    >
      <span className={`status-dot ${dotClass}`} />
      <span className="text-secondary">{name}</span>
      {status.latencyMs != null && (
        <span className="text-tertiary">{status.latencyMs}ms</span>
      )}
    </span>
  );
}

// ── Health History ────────────────────────────────────────────────────────────

function HealthHistoryPanel({ envId }: { envId: string }) {
  const { data } = useSWR<{ healthChecks: HealthCheckRecord[] }>(
    `/api/environments/${envId}/health?limit=20`,
    fetcher,
    { refreshInterval: 60_000 }
  );

  const checks = data?.healthChecks ?? [];
  const hasServiceStatuses = checks.some((c) => c.serviceStatuses != null);

  return (
    <div className="panel">
      <div className="panel__header">
        <span className="panel__title">Health History</span>
        <span className="font-mono text-[10px] text-tertiary">
          Last {checks.length} checks
        </span>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {checks.length === 0 ? (
          <div className="panel__content text-xs text-tertiary font-mono text-center py-6">
            No health checks recorded yet
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Backend</th>
                <th>Frontend</th>
                <th>B. Latency</th>
                <th>F. Latency</th>
                {hasServiceStatuses && <th>Services</th>}
              </tr>
            </thead>
            <tbody>
              {checks.map((c) => (
                <tr key={c.id}>
                  <td>
                    {new Date(c.checkedAt).toLocaleTimeString("en-US", {
                      hour12: false,
                    })}
                  </td>
                  <td>
                    <span
                      className={
                        c.backendStatus &&
                        c.backendStatus >= 200 &&
                        c.backendStatus < 300
                          ? "text-nominal"
                          : "text-critical"
                      }
                    >
                      {c.backendStatus ?? "—"}
                    </span>
                  </td>
                  <td>
                    <span
                      className={
                        c.frontendStatus &&
                        c.frontendStatus >= 200 &&
                        c.frontendStatus < 300
                          ? "text-nominal"
                          : "text-critical"
                      }
                    >
                      {c.frontendStatus ?? "—"}
                    </span>
                  </td>
                  <td>{c.backendMs ? `${c.backendMs}ms` : "—"}</td>
                  <td>{c.frontendMs ? `${c.frontendMs}ms` : "—"}</td>
                  {hasServiceStatuses && (
                    <td>
                      {c.serviceStatuses ? (
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(c.serviceStatuses).map(
                            ([name, svc]) => (
                              <ServiceBadge
                                key={name}
                                name={name}
                                status={svc}
                              />
                            )
                          )}
                        </div>
                      ) : (
                        <span className="text-tertiary">—</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Resource Metrics (exported) ──────────────────────────────────────────────

export function ResourceMetricsPanel({ envId }: { envId: string }) {
  const { data, isLoading } = useSWR<ResourcesData>(
    `/api/environments/${envId}/resources`,
    fetcher,
    { refreshInterval: 15_000 }
  );

  const m = data?.metrics;
  const machines = data?.machines ?? [];
  const volumes = data?.volumes ?? [];
  const ips = data?.ips ?? [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="panel">
              <div className="panel__content h-20 animate-pulse bg-elevated rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <UtilizationPanel envId={envId} />

      {m && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: "Total CPU", value: m.totalCpus, unit: "vCPUs" },
            { label: "Total RAM", value: m.totalMemoryMb, unit: "MB" },
            { label: "App Storage", value: m.totalVolumeGb, unit: "GB" },
            { label: "DB Storage", value: m.dbStorageGb, unit: "GB" },
            { label: "Public IPs", value: m.totalIps, unit: "allocated" },
          ].map(({ label, value, unit }) => (
            <div key={label} className="panel">
              <div className="panel__content py-3">
                <div className="metric">
                  <span className="metric__label">{label}</span>
                  <span className="metric__value metric__value--data text-xl">
                    {value}
                  </span>
                  <span className="text-[10px] text-tertiary">{unit}</span>
                </div>
              </div>
            </div>
          ))}
          <div className="panel">
            <div className="panel__content py-3">
              <div className="metric">
                <span className="metric__label">Machines</span>
                <span className="metric__value text-xl">
                  <span className="text-nominal">{m.runningMachines}</span>
                  <span className="text-tertiary text-sm">
                    /{m.totalMachines}
                  </span>
                </span>
                <span className="text-[10px] text-tertiary">running</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {machines.length > 0 && (
        <>
          <span className="label">Machines</span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {machines.map((machine) => (
              <div key={machine.id} className="panel">
                <div className="panel__header">
                  <div className="flex items-center gap-2">
                    <span
                      className={`status-dot ${machine.state === "started" ? "status-dot--nominal status-dot--pulse" : "status-dot--offline"}`}
                    />
                    <span className="panel__title">
                      {machine.name || machine.id.slice(0, 12)}
                    </span>
                  </div>
                  <span
                    className={`badge ${machine.state === "started" ? "badge--nominal" : "badge--neutral"}`}
                  >
                    {machine.state}
                  </span>
                </div>
                <div className="panel__content space-y-3">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <span className="label block mb-1">CPU</span>
                      <span className="font-mono text-sm text-primary">
                        {machine.cpus ?? "—"} vCPU
                      </span>
                      <p className="text-[10px] text-tertiary">
                        {machine.cpuKind}
                      </p>
                    </div>
                    <div>
                      <span className="label block mb-1">Memory</span>
                      <span className="font-mono text-sm text-primary">
                        {machine.memoryMb ?? "—"} MB
                      </span>
                    </div>
                    <div>
                      <span className="label block mb-1">Region</span>
                      <span className="font-mono text-sm text-primary">
                        {machine.region}
                      </span>
                    </div>
                  </div>

                  {machine.checks.length > 0 && (
                    <div className="pt-2 border-t border-border-dim">
                      <span className="label block mb-1.5">Health Checks</span>
                      <div className="space-y-1">
                        {machine.checks.map((c, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span
                              className={`status-dot ${c.status === "passing" ? "status-dot--nominal" : c.status === "warning" ? "status-dot--caution" : "status-dot--critical"}`}
                            />
                            <span className="font-mono text-xs text-primary">
                              {c.name}
                            </span>
                            <span
                              className={`font-mono text-[10px] ${c.status === "passing" ? "text-nominal" : "text-caution"}`}
                            >
                              {c.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {machine.events.length > 0 && (
                    <div className="pt-2 border-t border-border-dim">
                      <span className="label block mb-1.5">Recent Events</span>
                      <div className="space-y-1 max-h-24 overflow-y-auto">
                        {machine.events.slice(0, 5).map((ev, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 text-[10px] font-mono"
                          >
                            <span className="text-tertiary w-14 shrink-0">
                              {new Date(ev.timestamp).toLocaleTimeString(
                                "en-US",
                                {
                                  hour12: false,
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )}
                            </span>
                            <span
                              className={
                                ev.exitCode !== null && ev.exitCode !== 0
                                  ? "text-critical"
                                  : "text-secondary"
                              }
                            >
                              {ev.type}: {ev.status}
                              {ev.exitCode !== null
                                ? ` (exit ${ev.exitCode})`
                                : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-border-dim text-[10px] text-tertiary font-mono">
                    ID: {machine.id} · Updated:{" "}
                    {new Date(machine.updatedAt).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {data?.postgres && (
        <>
          <span className="label">Database (Postgres)</span>
          <div className="panel">
            <div className="panel__header">
              <div className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-[#60a5fa]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375"
                  />
                </svg>
                <span className="panel__title">{data.postgres.name}</span>
              </div>
              <a
                href={data.postgres.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-data text-xs font-mono hover:underline"
              >
                Open in Fly
              </a>
            </div>
            <div className="panel__content">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="metric">
                  <span className="metric__label">Storage</span>
                  <span className="metric__value metric__value--data text-lg">
                    {data.postgres.storageGb}
                  </span>
                  <span className="text-[10px] text-tertiary">GB total</span>
                </div>
                <div className="metric">
                  <span className="metric__label">Volumes</span>
                  <span className="metric__value text-lg">
                    {data.postgres.volumes.length}
                  </span>
                </div>
                <div className="metric">
                  <span className="metric__label">Machines</span>
                  <span className="metric__value text-lg">
                    {data.postgres.machines.length}
                  </span>
                </div>
                <div className="metric">
                  <span className="metric__label">Status</span>
                  <span
                    className={`font-mono text-sm ${data.postgres.machines.some((m) => m.state === "started") ? "text-nominal" : "text-caution"}`}
                  >
                    {data.postgres.machines.some((m) => m.state === "started")
                      ? "Running"
                      : "Stopped"}
                  </span>
                </div>
              </div>
              {data.postgres.volumes.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border-dim">
                  <span className="label block mb-1.5">Volumes</span>
                  <div className="space-y-1">
                    {data.postgres.volumes.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between font-mono text-xs"
                      >
                        <span className="text-primary">{v.name}</span>
                        <span className="text-tertiary">
                          {v.sizeGb ?? "?"}GB · {v.region}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="panel">
          <div className="panel__header">
            <span className="panel__title">App Volumes</span>
            <span className="font-mono text-[10px] text-tertiary">
              {volumes.length}
            </span>
          </div>
          <div className="panel__content">
            {volumes.length === 0 ? (
              <p className="text-xs text-tertiary">No volumes attached</p>
            ) : (
              <div className="space-y-2">
                {volumes.map((v) => (
                  <div key={v.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`status-dot ${v.state === "created" ? "status-dot--nominal" : "status-dot--offline"}`}
                      />
                      <span className="font-mono text-xs text-primary">
                        {v.name}
                      </span>
                    </div>
                    <span className="font-mono text-xs text-tertiary">
                      {v.sizeGb ?? "?"}GB · {v.region}
                      {v.encrypted ? " · encrypted" : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel__header">
            <span className="panel__title">IP Addresses</span>
            <span className="font-mono text-[10px] text-tertiary">
              {ips.length}
            </span>
          </div>
          <div className="panel__content">
            {ips.length === 0 ? (
              <p className="text-xs text-tertiary">None allocated</p>
            ) : (
              <div className="space-y-1.5">
                {ips.map((ip, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span
                      className={`font-mono text-[9px] uppercase px-1.5 py-0.5 rounded-sm ${ip.type === "v6" ? "bg-data-bg text-data" : "bg-caution-bg text-caution"}`}
                    >
                      {ip.type}
                    </span>
                    <span className="font-mono text-xs text-primary truncate flex-1">
                      {ip.address}
                    </span>
                    <span className="font-mono text-[10px] text-tertiary">
                      {ip.region}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <HealthHistoryPanel envId={envId} />
    </div>
  );
}
