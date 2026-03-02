"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import type { LogEntry, LogsResponse, LogTab } from "@/lib/types";
import { fetcher } from "@/lib/constants";

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

const SERVICE_META: Record<ServiceTag, { label: string; badge: string }> = {
  github:   { label: "GitHub",   badge: "bg-[#24292e] text-[#58a6ff]" },
  fly:      { label: "Fly",      badge: "bg-[#7c3aed]/20 text-[#a78bfa]" },
  postgres: { label: "Postgres", badge: "bg-[#1e40af]/20 text-[#60a5fa]" },
  machine:  { label: "Machine",  badge: "bg-[#065f46]/20 text-[#34d399]" },
  vercel:   { label: "Vercel",   badge: "bg-[#000]/30 text-[#e5e5e5]" },
  health:   { label: "Health",   badge: "bg-nominal-bg text-nominal" },
  rollback: { label: "Rollback", badge: "bg-critical-bg text-critical" },
  system:   { label: "System",   badge: "bg-[var(--bg-active)] text-tertiary" },
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

function LogLevelDot({ level }: { level: string }) {
  const cls =
    level === "error" ? "status-dot--critical" :
    level === "warn" ? "status-dot--caution" :
    "status-dot--nominal";
  return <span className={`status-dot ${cls}`} />;
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

const TAB_CONFIG: { id: LogTab; label: string }[] = [
  { id: "provision", label: "Provision" },
  { id: "fly",       label: "Fly Logs" },
  { id: "vercel",    label: "Vercel" },
];

export function LogsPanel({ envId }: { envId: string }) {
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
    fly: data?.fly?.length ?? 0,
    vercel: data?.vercel?.length ?? 0,
  };

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
