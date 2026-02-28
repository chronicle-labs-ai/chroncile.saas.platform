"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import type { EnvironmentRecord, HealthCheckRecord } from "@/lib/types";
import { ConfirmDestroyModal } from "@/components/ui/confirm-destroy-modal";
import { ProvisioningTimeline } from "@/components/ui/provisioning-timeline";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const TYPE_LABELS: Record<string, string> = {
  PRODUCTION: "PROD",
  STAGING: "STG",
  DEVELOPMENT: "DEV",
  EPHEMERAL: "EPH",
};

const BADGE_CLASS: Record<string, string> = {
  PRODUCTION: "badge--critical",
  STAGING: "badge--caution",
  DEVELOPMENT: "badge--data",
  EPHEMERAL: "badge--neutral",
};

interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
  source: "provision" | "fly-machine" | "fly-runtime" | "vercel-build";
}

interface LogsResponse {
  provision: LogEntry[];
  fly: LogEntry[];
  vercel: LogEntry[];
  errors: Record<string, string>;
}

type LogTab = "provision" | "fly" | "vercel";

interface Stats {
  tenants: number | null;
  users: number | null;
  events: number | null;
  runs: number | null;
  connections: number | null;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="shrink-0 p-1 text-tertiary hover:text-primary transition-colors"
      title="Copy URL"
    >
      {copied ? (
        <svg className="w-3.5 h-3.5 text-nominal" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
        </svg>
      )}
    </button>
  );
}

interface EndpointRowProps {
  label: string;
  url: string | null;
  badge?: string;
  badgeClass?: string;
  pending?: boolean;
  pendingHint?: string;
  extra?: string | null;
  extraLabel?: string;
}

function EndpointRow({ label, url, badge, badgeClass, pending, pendingHint, extra, extraLabel }: EndpointRowProps) {
  return (
    <div className="px-4 py-3 space-y-1.5">
      <div className="flex items-center gap-3">
        <span className="label shrink-0 w-20">{label}</span>

        {badge && (
          <span className={`font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm shrink-0 ${badgeClass}`}>
            {badge}
          </span>
        )}

        {url ? (
          <>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-data hover:underline font-mono text-sm truncate flex-1 min-w-0"
            >
              {url}
            </a>
            <CopyButton text={url} />
          </>
        ) : pending ? (
          <div className="flex items-center gap-2 flex-1">
            <div className="w-1.5 h-1.5 rounded-full bg-caution animate-pulse" />
            <span className="font-mono text-xs text-caution">Pending deployment</span>
          </div>
        ) : (
          <span className="font-mono text-sm text-tertiary">—</span>
        )}
      </div>

      {url && extra && (
        <div className="flex items-center gap-3 pl-[6.5rem]">
          <span className="label shrink-0">{extraLabel}</span>
          <a
            href={extra}
            target="_blank"
            rel="noopener noreferrer"
            className="text-tertiary hover:text-data font-mono text-xs truncate flex-1 min-w-0 transition-colors"
          >
            {extra}
          </a>
          <CopyButton text={extra} />
        </div>
      )}

      {pending && pendingHint && (
        <p className="pl-[6.5rem] text-[10px] text-tertiary font-mono">{pendingHint}</p>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="panel">
      <div className="panel__content">
        <div className="metric">
          <span className="metric__label">{label}</span>
          <span className="metric__value metric__value--data">
            {value !== null ? value.toLocaleString() : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

function LogLevelDot({ level }: { level: string }) {
  const cls =
    level === "error" ? "status-dot--critical" :
    level === "warn" ? "status-dot--caution" :
    "status-dot--nominal";
  return <span className={`status-dot ${cls}`} />;
}

// ── Service tag detection ─────────────────────────────────────────────────────

type ServiceTag = "github" | "fly" | "postgres" | "vercel" | "machine" | "rollback" | "health" | "system";

const SERVICE_PATTERNS: [RegExp, ServiceTag][] = [
  [/rollback/i,                                           "rollback"],
  [/github|branch sha|branch info/i,                     "github"],
  [/fly postgres|postgres cluster|postgres attach/i,     "postgres"],
  [/fly app|fly.io app|creating fly app|fly app creat|reusing/i, "fly"],
  [/machine|creating machine/i,                          "machine"],
  [/public ip|ip allocat/i,                              "fly"],
  [/vercel/i,                                            "vercel"],
  [/healthy|health|waiting for/i,                        "health"],
];

const SERVICE_META: Record<ServiceTag, { label: string; badge: string; dot: string }> = {
  github:   { label: "GitHub",   badge: "bg-[#24292e] text-[#58a6ff]",          dot: "bg-[#58a6ff]" },
  fly:      { label: "Fly",      badge: "bg-[#7c3aed]/20 text-[#a78bfa]",       dot: "bg-[#a78bfa]" },
  postgres: { label: "Postgres", badge: "bg-[#1e40af]/20 text-[#60a5fa]",       dot: "bg-[#60a5fa]" },
  machine:  { label: "Machine",  badge: "bg-[#065f46]/20 text-[#34d399]",       dot: "bg-[#34d399]" },
  vercel:   { label: "Vercel",   badge: "bg-[#000]/30 text-[#e5e5e5]",          dot: "bg-[#e5e5e5]" },
  health:   { label: "Health",   badge: "bg-nominal-bg text-nominal",            dot: "bg-nominal" },
  rollback: { label: "Rollback", badge: "bg-critical-bg text-critical",          dot: "bg-critical" },
  system:   { label: "System",   badge: "bg-[var(--bg-active)] text-tertiary",   dot: "bg-tertiary" },
};

function detectService(message: string): ServiceTag {
  for (const [pattern, tag] of SERVICE_PATTERNS) {
    if (pattern.test(message)) return tag;
  }
  return "system";
}

function ServiceBadge({ tag }: { tag: ServiceTag }) {
  const meta = SERVICE_META[tag];
  return (
    <span className={`shrink-0 font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${meta.badge}`}>
      {meta.label}
    </span>
  );
}

function LogLine({ log, showService }: { log: LogEntry; showService?: boolean }) {
  const textColor =
    log.level === "error" ? "text-critical" :
    log.level === "warn" ? "text-caution" :
    "text-secondary";

  const service = showService ? detectService(log.message) : null;

  return (
    <div className={`flex items-start gap-2.5 px-4 py-1.5 hover:bg-[var(--bg-hover)] transition-colors ${
      log.level === "error" ? "bg-[var(--critical-bg)]/40" :
      log.level === "warn"  ? "bg-[var(--caution-bg)]/20" : ""
    }`}>
      <LogLevelDot level={log.level} />
      <span className="font-mono text-[10px] text-tertiary shrink-0 w-[5rem] pt-px tabular-nums">
        {new Date(log.timestamp).toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })}
      </span>
      {service && <ServiceBadge tag={service} />}
      <span className={`font-mono text-xs flex-1 break-all ${textColor}`}>
        {log.message}
      </span>
    </div>
  );
}

const TAB_CONFIG: { id: LogTab; label: string; sourceLabel: string }[] = [
  { id: "provision", label: "Provision", sourceLabel: "provision" },
  { id: "fly",       label: "Fly Logs",  sourceLabel: "fly" },
  { id: "vercel",    label: "Vercel",    sourceLabel: "vercel" },
];

function LogsPanel({ envId }: { envId: string }) {
  const [tab, setTab] = useState<LogTab>("provision");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useSWR<LogsResponse>(
    `/api/environments/${envId}/logs`,
    fetcher,
    { refreshInterval: 30_000 }
  );

  const logs: LogEntry[] = data ? (tab === "fly" ? [...(data.fly ?? [])] : data[tab] ?? []) : [];
  const error = data?.errors?.[tab === "fly" ? "fly" : tab];

  const counts = {
    provision: data?.provision?.length ?? 0,
    fly: (data?.fly?.length ?? 0),
    vercel: data?.vercel?.length ?? 0,
  };

  // Auto-scroll to bottom when new logs arrive on provision tab
  useEffect(() => {
    if (tab === "provision" && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [data, tab]);

  return (
    <div className="panel col-span-full">
      <div className="panel__header">
        <span className="panel__title">Logs</span>
        {isLoading && (
          <div className="w-3 h-3 rounded-full border-2 border-[var(--border-bright)] border-t-[var(--data)] animate-spin" />
        )}
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-[var(--border-dim)] bg-[var(--bg-elevated)]">
        {TAB_CONFIG.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative flex items-center gap-2 px-4 py-2.5 text-xs font-mono transition-colors ${
              tab === t.id
                ? "text-data border-b-2 border-data -mb-px bg-[var(--data-bg)]"
                : "text-tertiary hover:text-secondary border-b-2 border-transparent"
            }`}
          >
            {t.label}
            {counts[t.id] > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-sm font-mono ${
                tab === t.id
                  ? "bg-[var(--data-dim)] text-data"
                  : "bg-[var(--bg-active)] text-tertiary"
              }`}>
                {counts[t.id]}
              </span>
            )}
            {data?.errors?.[t.id === "fly" ? "fly" : t.id] && (
              <span className="w-1.5 h-1.5 rounded-full bg-caution" />
            )}
          </button>
        ))}
      </div>

      {/* Log body */}
      <div ref={scrollRef} className="max-h-80 overflow-y-auto">
        {isLoading && (
          <div className="px-4 py-6 text-xs text-secondary font-mono text-center">
            Loading logs...
          </div>
        )}
        {!isLoading && error && (
          <div className="px-4 py-3 flex items-center gap-2 border-b border-[var(--border-dim)]">
            <span className="status-dot status-dot--caution" />
            <span className="text-xs text-caution font-mono">{error}</span>
          </div>
        )}
        {!isLoading && logs.length === 0 && !error && (
          <div className="px-4 py-8 text-xs text-tertiary font-mono text-center">
            {tab === "provision"
              ? "No provisioning logs yet"
              : tab === "fly"
              ? "No Fly.io logs available"
              : "No Vercel build logs available"}
          </div>
        )}
        {logs.length > 0 && (
          <div className="divide-y divide-[var(--border-dim)]">
            {logs.map((log, i) => (
              <LogLine key={i} log={log} showService={tab === "provision"} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HealthHistoryPanel({ envId }: { envId: string }) {
  const { data } = useSWR<{ healthChecks: HealthCheckRecord[] }>(
    `/api/environments/${envId}/health?limit=20`,
    fetcher,
    { refreshInterval: 60_000 }
  );

  const checks = data?.healthChecks ?? [];

  return (
    <div className="panel">
      <div className="panel__header">
        <span className="panel__title">Health History</span>
        <span className="font-mono text-[10px] text-tertiary">
          Last {checks.length} checks
        </span>
      </div>
      <div className="max-h-60 overflow-y-auto">
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
              </tr>
            </thead>
            <tbody>
              {checks.map((c) => (
                <tr key={c.id}>
                  <td>
                    {new Date(c.checkedAt).toLocaleTimeString("en-US", { hour12: false })}
                  </td>
                  <td>
                    <span className={c.backendStatus && c.backendStatus >= 200 && c.backendStatus < 300 ? "text-nominal" : "text-critical"}>
                      {c.backendStatus ?? "—"}
                    </span>
                  </td>
                  <td>
                    <span className={c.frontendStatus && c.frontendStatus >= 200 && c.frontendStatus < 300 ? "text-nominal" : "text-critical"}>
                      {c.frontendStatus ?? "—"}
                    </span>
                  </td>
                  <td>{c.backendMs ? `${c.backendMs}ms` : "—"}</td>
                  <td>{c.frontendMs ? `${c.frontendMs}ms` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function EnvironmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [destroying, setDestroying] = useState(false);
  const [showDestroyModal, setShowDestroyModal] = useState(false);

  const [fastPoll, setFastPoll] = useState(true);

  const { data: env, isLoading } = useSWR<EnvironmentRecord>(
    `/api/environments/${id}`,
    fetcher,
    {
      refreshInterval: fastPoll ? 2_000 : 10_000,
      onSuccess: (data) => {
        if (data.status !== "PROVISIONING" && data.status !== "DESTROYING") {
          setFastPoll(false);
        }
      },
    }
  );

  const isProvisioning = env?.status === "PROVISIONING";

  const { data: stats } = useSWR<Stats>(
    env ? `/api/environments/${id}/stats` : null,
    fetcher,
    { refreshInterval: 60_000 }
  );

  const handleDestroy = async () => {
    if (!env) return;
    setDestroying(true);
    setShowDestroyModal(false);
    await fetch(`/api/environments/${id}`, { method: "DELETE" });
    router.push("/dashboard");
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="text-secondary text-sm font-mono">Loading environment...</div>
      </div>
    );
  }

  if (!env) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="panel">
          <div className="panel__content text-center py-8">
            <p className="text-secondary text-sm mb-3">Environment not found</p>
            <Link href="/dashboard" className="btn btn--secondary btn--sm">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    {showDestroyModal && env && (
      <ConfirmDestroyModal
        environmentName={env.name}
        destroying={destroying}
        onConfirm={handleDestroy}
        onCancel={() => setShowDestroyModal(false)}
      />
    )}
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link href="/dashboard" className="btn btn--ghost btn--sm mb-4 inline-flex">
          &larr; All Environments
        </Link>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className={`badge ${BADGE_CLASS[env.type]}`}>
              {TYPE_LABELS[env.type]}
            </span>
            <h1 className="text-xl font-sans font-semibold">{env.name}</h1>
            <span className={`status-dot ${env.isHealthy ? "status-dot--nominal status-dot--pulse" : "status-dot--critical"}`} />
          </div>
          <div className="flex items-center gap-3">
            {env.type === "EPHEMERAL" && env.status !== "DESTROYING" && (
              <button
                onClick={() => setShowDestroyModal(true)}
                disabled={destroying}
                className="btn btn--critical btn--sm disabled:opacity-40"
              >
                {destroying ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full border-2 border-critical/40 border-t-critical animate-spin" />
                    Destroying...
                  </span>
                ) : "Destroy Environment"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Info bar */}
      <div className="panel">
        <div className="panel__content">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <span className="label block mb-1">Status</span>
              <span className="font-mono text-sm text-primary">{env.status}</span>
            </div>
            <div>
              <span className="label block mb-1">Branch</span>
              <span className="font-mono text-sm text-primary">{env.gitBranch ?? "—"}</span>
            </div>
            <div>
              <span className="label block mb-1">Commit</span>
              <span className="font-mono text-sm text-primary">{env.gitSha?.slice(0, 7) ?? "—"}</span>
            </div>
            <div>
              <span className="label block mb-1">Created</span>
              <span className="font-mono text-sm text-primary">
                {new Date(env.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Provisioning timeline */}
      {(env.provisionLog || env.type === "EPHEMERAL") && (
        <ProvisioningTimeline
          provisionLog={env.provisionLog}
          envStatus={env.status}
          isProvisioning={isProvisioning}
        />
      )}

      {/* URLs */}
      <div className="panel">
        <div className="panel__header">
          <span className="panel__title">Endpoints</span>
        </div>
        <div className="divide-y divide-[var(--border-dim)]">
          <EndpointRow
            label="Backend"
            url={env.flyAppUrl}
            badge="Fly.io"
            badgeClass="bg-[#7c3aed]/20 text-[#a78bfa]"
            extra={env.flyAppUrl ? `${env.flyAppUrl}/health` : null}
            extraLabel="Health"
          />
          <EndpointRow
            label="Frontend"
            url={env.vercelUrl}
            badge="Vercel"
            badgeClass="bg-[#000]/30 text-[#e5e5e5]"
            pending={!env.vercelUrl && env.type === "EPHEMERAL"}
            pendingHint="Vercel preview will appear after the next branch push"
            extra={env.vercelUrl ? `${env.vercelUrl}/api/system/info` : null}
            extraLabel="Info"
          />
          {env.expiresAt && (
            <div className="flex items-center gap-4 px-4 py-3">
              <span className="label shrink-0 w-20">Expires</span>
              <span className="font-mono text-sm text-caution">
                {new Date(env.expiresAt).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Error log */}
      {env.errorLog && (
        <div className="panel border-[var(--critical-dim)]">
          <div className="panel__header bg-[var(--critical-bg)]">
            <div className="flex items-center gap-2">
              <span className="status-dot status-dot--critical" />
              <span className="panel__title text-critical">
                {env.status === "ERROR" ? "Provisioning Error" : "Warnings"}
              </span>
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto bg-[var(--critical-bg)]">
            <pre className="px-4 py-3 text-xs font-mono text-critical/90 whitespace-pre-wrap break-all leading-relaxed">
              {env.errorLog}
            </pre>
          </div>
        </div>
      )}

      {/* Stats metrics */}
      <div>
        <span className="label block mb-3">Platform Metrics</span>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Tenants" value={stats?.tenants ?? null} />
          <StatCard label="Users" value={stats?.users ?? null} />
          <StatCard label="Events" value={stats?.events ?? null} />
          <StatCard label="Runs" value={stats?.runs ?? null} />
          <StatCard label="Connections" value={stats?.connections ?? null} />
        </div>
      </div>

      {/* Logs (full width) + Health */}
      <div className="grid grid-cols-1 gap-6">
        <LogsPanel envId={id} />
        <HealthHistoryPanel envId={id} />
      </div>
    </div>
    </>
  );
}
