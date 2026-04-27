"use client";

import { useState } from "react";
import useSWR from "swr";
import type { StressTestRecord } from "@/shared/types";
import { fetcher } from "@/shared/fetcher";

// ── Constants ────────────────────────────────────────────────────────────────

const PRESET_ENDPOINTS = [
  { value: "/health", label: "GET /health", alwaysOn: true },
  {
    value: "/api/platform/dashboard/stats",
    label: "GET /api/platform/dashboard/stats",
  },
  { value: "/api/platform/auth/login", label: "POST /auth/login" },
];

const VU_OPTIONS = [10, 50, 100, 200, 500];
const DURATION_OPTIONS = ["30s", "1m", "5m", "10m"];
const RAMPUP_OPTIONS = [
  { value: "none", label: "None" },
  { value: "30s", label: "30 seconds" },
  { value: "1m", label: "1 minute" },
];

const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  queued: { cls: "badge--neutral", label: "Queued" },
  initializing: { cls: "badge--caution", label: "Initializing" },
  running: { cls: "badge--data", label: "Running" },
  finished: { cls: "badge--nominal", label: "Finished" },
  aborted: { cls: "badge--neutral", label: "Aborted" },
  error: { cls: "badge--critical", label: "Error" },
};

const ACTIVE_STATUSES = new Set(["queued", "initializing", "running"]);

// ── Load Tests Panel ─────────────────────────────────────────────────────────

export function LoadTestsPanel({
  envId,
  isRunning,
}: {
  envId: string;
  isRunning: boolean;
}) {
  const [name, setName] = useState(
    `Load test — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
  );
  const [vus, setVus] = useState(50);
  const [duration, setDuration] = useState("1m");
  const [rampUp, setRampUp] = useState("30s");
  const [selectedEndpoints, setSelectedEndpoints] = useState<string[]>([
    "/health",
  ]);
  const [customEndpoint, setCustomEndpoint] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pollFast, setPollFast] = useState(false);

  const { data: tests, mutate } = useSWR<StressTestRecord[]>(
    `/api/environments/${envId}/load-tests`,
    fetcher,
    {
      refreshInterval: pollFast ? 5_000 : 30_000,
      onSuccess: (data) => {
        setPollFast(data.some((t) => ACTIVE_STATUSES.has(t.status)));
      },
    }
  );

  const hasActiveTest = tests?.some((t) => ACTIVE_STATUSES.has(t.status));

  const handleToggleEndpoint = (ep: string) => {
    setSelectedEndpoints((prev) =>
      prev.includes(ep) ? prev.filter((e) => e !== ep) : [...prev, ep]
    );
  };

  const handleAddCustom = () => {
    const trimmed = customEndpoint.trim();
    if (!trimmed) return;
    const normalized =
      trimmed.startsWith("/") || trimmed.startsWith("http")
        ? trimmed
        : `/${trimmed}`;
    if (!selectedEndpoints.includes(normalized)) {
      setSelectedEndpoints((prev) => [...prev, normalized]);
    }
    setCustomEndpoint("");
  };

  const handleSubmit = async () => {
    setFormError(null);
    if (selectedEndpoints.length === 0) {
      setFormError("Select at least one endpoint");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/environments/${envId}/load-tests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          vus,
          duration,
          rampUp,
          endpoints: selectedEndpoints,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        setFormError(err.error ?? err.detail ?? "Failed to start test");
        return;
      }
      setName(
        `Load test — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
      );
      mutate();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAbort = async (testId: string) => {
    await fetch(`/api/environments/${envId}/load-tests/${testId}/abort`, {
      method: "POST",
    });
    mutate();
  };

  const canRun = isRunning && !hasActiveTest && !submitting;
  const selectClass =
    "w-full px-3 py-2 bg-[var(--bg-active)] border border-[var(--border-dim)] rounded text-sm text-primary font-mono focus:border-data focus:outline-none";

  return (
    <div className="space-y-6">
      <div className="panel">
        <div className="panel__header">
          <span className="panel__title">New Load Test</span>
          {!isRunning && (
            <span className="text-xs text-caution font-mono">
              Environment must be running
            </span>
          )}
        </div>
        <div className="panel__content space-y-4">
          <div>
            <label className="label block mb-1">Test Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={selectClass}
              placeholder="Load test — Feb 28"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label block mb-1">Virtual Users</label>
              <select
                value={vus}
                onChange={(e) => setVus(Number(e.target.value))}
                className={selectClass}
              >
                {VU_OPTIONS.map((v) => (
                  <option key={v} value={v}>
                    {v} VUs
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label block mb-1">Duration</label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className={selectClass}
              >
                {DURATION_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label block mb-1">Ramp-up</label>
              <select
                value={rampUp}
                onChange={(e) => setRampUp(e.target.value)}
                className={selectClass}
              >
                {RAMPUP_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label block mb-2">Endpoints</label>
            <div className="space-y-2">
              {PRESET_ENDPOINTS.map((ep) => (
                <label
                  key={ep.value}
                  className="flex items-center gap-2 text-sm text-primary cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedEndpoints.includes(ep.value)}
                    onChange={() =>
                      !ep.alwaysOn && handleToggleEndpoint(ep.value)
                    }
                    disabled={ep.alwaysOn}
                    className="accent-[var(--data)]"
                  />
                  <span className="font-mono text-xs">{ep.label}</span>
                  {ep.alwaysOn && (
                    <span className="text-[10px] text-tertiary">
                      (always included)
                    </span>
                  )}
                </label>
              ))}
              {selectedEndpoints
                .filter((ep) => !PRESET_ENDPOINTS.some((p) => p.value === ep))
                .map((ep) => (
                  <div key={ep} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked
                      readOnly
                      className="accent-[var(--data)]"
                    />
                    <span className="font-mono text-xs text-primary">{ep}</span>
                    <button
                      onClick={() =>
                        setSelectedEndpoints((prev) =>
                          prev.filter((e) => e !== ep)
                        )
                      }
                      className="text-tertiary hover:text-critical text-xs"
                    >
                      remove
                    </button>
                  </div>
                ))}
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="text"
                  value={customEndpoint}
                  onChange={(e) => setCustomEndpoint(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddCustom()}
                  placeholder="/api/custom/endpoint"
                  className="flex-1 px-3 py-1.5 bg-[var(--bg-active)] border border-[var(--border-dim)] rounded text-xs text-primary font-mono focus:border-data focus:outline-none"
                />
                <button
                  onClick={handleAddCustom}
                  className="btn btn--secondary btn--sm text-xs"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          {formError && (
            <div className="px-3 py-2 bg-[var(--critical-bg)] border border-[var(--critical-dim)] rounded text-xs text-critical font-mono">
              {formError}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!canRun}
            className="btn btn--primary btn--sm disabled:opacity-40"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                Starting...
              </span>
            ) : hasActiveTest ? (
              "Test already running"
            ) : (
              "Run Load Test"
            )}
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="panel__header">
          <span className="panel__title">Test History</span>
          {tests && (
            <span className="text-xs text-tertiary font-mono">
              {tests.length} tests
            </span>
          )}
        </div>
        {!tests ? (
          <div className="panel__content text-center py-6">
            <span className="text-xs text-tertiary font-mono">Loading...</span>
          </div>
        ) : tests.length === 0 ? (
          <div className="panel__content text-center py-6">
            <span className="text-xs text-tertiary font-mono">
              No load tests yet
            </span>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-dim)]">
            {tests.map((test) => {
              const badge = STATUS_BADGE[test.status] ?? STATUS_BADGE.error;
              const isActive = ACTIVE_STATUSES.has(test.status);
              return (
                <div key={test.id} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm text-primary">
                        {test.name}
                      </span>
                      <span className={`badge ${badge.cls}`}>
                        {badge.label}
                      </span>
                      {isActive && (
                        <span className="w-2 h-2 rounded-full bg-data animate-pulse" />
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {test.k6Url && (
                        <a
                          href={test.k6Url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-data hover:underline font-mono"
                        >
                          k6 Dashboard
                        </a>
                      )}
                      {isActive && (
                        <button
                          onClick={() => handleAbort(test.id)}
                          className="btn btn--critical btn--sm text-xs"
                        >
                          Abort
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-tertiary font-mono">
                    <span>{test.config.vus} VUs</span>
                    <span>{test.config.duration}</span>
                    <span>
                      {test.config.endpoints.length} endpoint
                      {test.config.endpoints.length !== 1 ? "s" : ""}
                    </span>
                    <span>{new Date(test.createdAt).toLocaleString()}</span>
                    {test.resultSummary && (
                      <>
                        {test.resultSummary.avgLatency != null && (
                          <span>
                            avg {test.resultSummary.avgLatency.toFixed(0)}ms
                          </span>
                        )}
                        {test.resultSummary.p95 != null && (
                          <span>p95 {test.resultSummary.p95.toFixed(0)}ms</span>
                        )}
                        {test.resultSummary.errorRate != null && (
                          <span
                            className={
                              test.resultSummary.errorRate > 0.05
                                ? "text-critical"
                                : ""
                            }
                          >
                            {(test.resultSummary.errorRate * 100).toFixed(1)}%
                            errors
                          </span>
                        )}
                      </>
                    )}
                    {test.status === "error" &&
                      test.resultSummary &&
                      "error" in test.resultSummary && (
                        <span className="text-critical">
                          {String(
                            (test.resultSummary as Record<string, unknown>)
                              .error
                          )}
                        </span>
                      )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
