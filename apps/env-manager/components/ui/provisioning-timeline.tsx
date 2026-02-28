"use client";

import { useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type StepStatus = "pending" | "running" | "done" | "failed" | "skipped";

interface ParsedLine {
  timestamp: string;
  level: "info" | "warn" | "error";
  raw: string;
  message: string;
}

interface TimelineStep {
  id: string;
  label: string;
  service: "github" | "fly" | "postgres" | "machine" | "vercel" | "health" | "rollback";
  status: StepStatus;
  startedAt: string | null;
  endedAt: string | null;
  durationMs: number | null;
  lines: ParsedLine[];
}

// ── Step definitions ──────────────────────────────────────────────────────────
// Each step has patterns that mark its start and its successful end.
// Lines between start and next step start are attributed to that step.

const STEP_DEFS: Array<{
  id: string;
  label: string;
  service: TimelineStep["service"];
  startPat: RegExp;
  donePat: RegExp;
}> = [
  {
    id: "github",
    label: "Fetch Branch Info",
    service: "github",
    startPat: /fetching branch info/i,
    donePat: /branch sha:/i,
  },
  {
    id: "postgres",
    label: "Create Postgres Cluster",
    service: "postgres",
    startPat: /creating fly postgres cluster/i,
    donePat: /postgres cluster created|already exists.*reusing/i,
  },
  {
    id: "fly-app",
    label: "Create Fly App",
    service: "fly",
    startPat: /creating fly app:|fly app already exists/i,
    donePat: /fly app created|reusing/i,
  },
  {
    id: "attach",
    label: "Attach Postgres",
    service: "postgres",
    startPat: /attaching postgres/i,
    donePat: /database_url extracted|postgres attached/i,
  },
  {
    id: "ips",
    label: "Allocate Public IPs",
    service: "fly",
    startPat: /allocating public ip/i,
    donePat: /ips allocated/i,
  },
  {
    id: "machine",
    label: "Create Machine",
    service: "machine",
    startPat: /creating machine in/i,
    donePat: /machine created/i,
  },
  {
    id: "health",
    label: "Wait for Healthy",
    service: "health",
    startPat: /waiting for healthy|machine created, waiting/i,
    donePat: /backend is healthy/i,
  },
  {
    id: "vercel",
    label: "Configure Vercel",
    service: "vercel",
    startPat: /setting vercel env var/i,
    donePat: /provisioning complete|vercel deployment ready/i,
  },
];

// ── Parser ────────────────────────────────────────────────────────────────────

function parseLine(raw: string): ParsedLine | null {
  if (!raw.trim()) return null;
  const m = raw.match(/^\[(\d{4}-\d{2}-\d{2}T[\d:.Z]+)\]\s+(INFO|WARN|ERROR|FATAL):\s*(.+)$/);
  if (!m) return { timestamp: "", level: "info", raw, message: raw };
  return {
    timestamp: m[1],
    level: m[2] === "FATAL" || m[2] === "ERROR" ? "error" : m[2] === "WARN" ? "warn" : "info",
    raw,
    message: m[3],
  };
}

export function parseProvisionLog(
  rawLog: string | null,
  envStatus: string
): TimelineStep[] {
  const lines = (rawLog ?? "").split("\n").map(parseLine).filter(Boolean) as ParsedLine[];

  const hasRollback = lines.some((l) => /rollback/i.test(l.message));
  const isDone = envStatus === "RUNNING" || envStatus === "ERROR";

  // Build step buckets
  const steps: TimelineStep[] = STEP_DEFS.map((def) => ({
    id: def.id,
    label: def.label,
    service: def.service,
    status: "pending" as StepStatus,
    startedAt: null,
    endedAt: null,
    durationMs: null,
    lines: [],
  }));

  let activeStepIdx = -1;

  for (const line of lines) {
    // Detect rollback — mark all in-progress / pending steps as failed
    if (/rollback:/i.test(line.message)) {
      for (const s of steps) {
        if (s.status === "running") { s.status = "failed"; s.endedAt = line.timestamp; }
        if (s.status === "pending") s.status = "failed";
      }
      activeStepIdx = -1;
      continue;
    }

    // Check if this line starts a new step
    const startingIdx = STEP_DEFS.findIndex((d) => d.startPat.test(line.message));
    if (startingIdx !== -1) {
      // Close previous step if it was running
      if (activeStepIdx !== -1 && steps[activeStepIdx].status === "running") {
        steps[activeStepIdx].status = "done";
        steps[activeStepIdx].endedAt = line.timestamp;
      }
      activeStepIdx = startingIdx;
      const s = steps[activeStepIdx];
      s.status = "running";
      s.startedAt = line.timestamp;
    }

    // Attribute line to active step
    if (activeStepIdx !== -1) {
      steps[activeStepIdx].lines.push(line);

      // Check for step completion
      const def = STEP_DEFS[activeStepIdx];
      if (s_done(def.donePat, line.message) && steps[activeStepIdx].status === "running") {
        steps[activeStepIdx].status = "done";
        steps[activeStepIdx].endedAt = line.timestamp;
      }

      // Error line in running step = step failed
      if (line.level === "error" && steps[activeStepIdx].status === "running") {
        steps[activeStepIdx].status = "failed";
        steps[activeStepIdx].endedAt = line.timestamp;
      }
    }
  }

  // Calculate durations
  for (const s of steps) {
    if (s.startedAt && s.endedAt) {
      s.durationMs = new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime();
    }
  }

  // If env is running and a step is still marked running (last step), close it
  if (isDone && !hasRollback) {
    const last = steps.find((s) => s.status === "running");
    if (last) last.status = "done";
  }

  return steps;
}

function s_done(pat: RegExp, msg: string) { return pat.test(msg); }

// ── Icons ─────────────────────────────────────────────────────────────────────

const SERVICE_ICONS: Record<TimelineStep["service"], React.ReactNode> = {
  github: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  ),
  fly: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
    </svg>
  ),
  postgres: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 2.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
    </svg>
  ),
  machine: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
    </svg>
  ),
  vercel: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M24 22.525H0l12-21.05 12 21.05z" />
    </svg>
  ),
  health: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  rollback: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
    </svg>
  ),
};

// ── Status indicator ──────────────────────────────────────────────────────────

function StepStatusIcon({ status }: { status: StepStatus }) {
  if (status === "done") {
    return (
      <div className="w-7 h-7 rounded-full bg-nominal-bg border border-nominal-dim flex items-center justify-center shrink-0">
        <svg className="w-4 h-4 text-nominal" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </div>
    );
  }
  if (status === "failed") {
    return (
      <div className="w-7 h-7 rounded-full bg-critical-bg border border-critical-dim flex items-center justify-center shrink-0">
        <svg className="w-4 h-4 text-critical" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    );
  }
  if (status === "running") {
    return (
      <div className="w-7 h-7 rounded-full bg-data-bg border border-data-dim flex items-center justify-center shrink-0">
        <div className="w-4 h-4 rounded-full border-2 border-[var(--data-dim)] border-t-[var(--data)] animate-spin" />
      </div>
    );
  }
  if (status === "skipped") {
    return (
      <div className="w-7 h-7 rounded-full bg-elevated border border-border-dim flex items-center justify-center shrink-0">
        <svg className="w-4 h-4 text-disabled" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
        </svg>
      </div>
    );
  }
  // pending
  return (
    <div className="w-7 h-7 rounded-full bg-elevated border border-border-default flex items-center justify-center shrink-0">
      <div className="w-2 h-2 rounded-full bg-tertiary" />
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

const SERVICE_COLOR: Record<TimelineStep["service"], string> = {
  github:   "text-[#58a6ff]",
  fly:      "text-[#a78bfa]",
  postgres: "text-[#60a5fa]",
  machine:  "text-[#34d399]",
  vercel:   "text-[#e5e5e5]",
  health:   "text-nominal",
  rollback: "text-critical",
};

// ── Step row ──────────────────────────────────────────────────────────────────

function StepRow({ step, isLast }: { step: TimelineStep; isLast: boolean }) {
  const [expanded, setExpanded] = useState(
    step.status === "running" || step.status === "failed"
  );

  const hasLines = step.lines.length > 0;
  const canExpand = hasLines && step.status !== "pending";

  return (
    <div className="relative">
      {/* Vertical connector */}
      {!isLast && (
        <div
          className={`absolute left-[13px] top-7 w-px h-full ${
            step.status === "done" ? "bg-nominal-dim" :
            step.status === "failed" ? "bg-critical-dim" :
            "bg-border-default"
          }`}
          style={{ top: "28px", height: "calc(100% - 4px)" }}
        />
      )}

      <div className="flex items-start gap-3 py-2 relative z-10">
        <StepStatusIcon status={step.status} />

        <div className="flex-1 min-w-0 pt-0.5">
          <button
            onClick={() => canExpand && setExpanded((e) => !e)}
            disabled={!canExpand}
            className={`w-full flex items-center gap-2 text-left ${canExpand ? "cursor-pointer group" : "cursor-default"}`}
          >
            {/* Service icon */}
            <span className={`shrink-0 ${SERVICE_COLOR[step.service]}`}>
              {SERVICE_ICONS[step.service]}
            </span>

            {/* Label */}
            <span className={`text-sm font-medium flex-1 min-w-0 ${
              step.status === "pending" ? "text-tertiary" :
              step.status === "done" ? "text-primary" :
              step.status === "running" ? "text-data" :
              step.status === "failed" ? "text-critical" :
              "text-disabled"
            }`}>
              {step.label}
            </span>

            {/* Duration */}
            {step.durationMs !== null && (
              <span className="font-mono text-[10px] text-tertiary shrink-0 tabular-nums">
                {formatDuration(step.durationMs)}
              </span>
            )}
            {step.status === "running" && (
              <span className="font-mono text-[10px] text-data shrink-0 animate-pulse">
                running...
              </span>
            )}

            {/* Expand chevron */}
            {canExpand && (
              <svg
                className={`w-3.5 h-3.5 text-tertiary shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            )}
          </button>

          {/* Log output */}
          {expanded && hasLines && (
            <div className="mt-2 ml-6 bg-elevated border border-border-dim rounded-sm overflow-hidden">
              <div className="max-h-48 overflow-y-auto">
                {step.lines.map((line, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 px-3 py-1 border-b border-border-dim last:border-b-0 ${
                      line.level === "error" ? "bg-critical-bg" :
                      line.level === "warn" ? "bg-caution-bg" : ""
                    }`}
                  >
                    {line.timestamp && (
                      <span className="font-mono text-[10px] text-tertiary shrink-0 tabular-nums pt-px">
                        {new Date(line.timestamp).toLocaleTimeString("en-US", {
                          hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit",
                        })}
                      </span>
                    )}
                    <span className={`font-mono text-[11px] flex-1 break-all ${
                      line.level === "error" ? "text-critical" :
                      line.level === "warn" ? "text-caution" :
                      "text-secondary"
                    }`}>
                      {line.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

interface Props {
  provisionLog: string | null;
  envStatus: string;
  isProvisioning: boolean;
}

export function ProvisioningTimeline({ provisionLog, envStatus, isProvisioning }: Props) {
  const steps = parseProvisionLog(provisionLog, envStatus);

  const doneCount = steps.filter((s) => s.status === "done").length;
  const totalCount = steps.length;
  const hasFailed = steps.some((s) => s.status === "failed");

  const totalDuration = steps.reduce((acc, s) => acc + (s.durationMs ?? 0), 0);

  return (
    <div className="panel">
      <div className="panel__header">
        <div className="flex items-center gap-2">
          {isProvisioning && (
            <div className="w-3 h-3 rounded-full border-2 border-border-bright border-t-data animate-spin" />
          )}
          {!isProvisioning && hasFailed && <span className="status-dot status-dot--critical" />}
          {!isProvisioning && !hasFailed && envStatus === "RUNNING" && (
            <span className="status-dot status-dot--nominal" />
          )}
          <span className="panel__title">
            {isProvisioning ? "Provisioning..." : "Provision Timeline"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {totalDuration > 0 && (
            <span className="font-mono text-[10px] text-tertiary">
              {formatDuration(totalDuration)} total
            </span>
          )}
          <span className="font-mono text-[10px] text-tertiary">
            {doneCount}/{totalCount} steps
          </span>
        </div>
      </div>

      <div className="panel__content pb-2">
        {steps.map((step, i) => (
          <StepRow
            key={step.id}
            step={step}
            isLast={i === steps.length - 1}
          />
        ))}
      </div>
    </div>
  );
}
