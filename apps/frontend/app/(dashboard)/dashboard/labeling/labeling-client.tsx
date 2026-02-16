"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { TraceSummary, TraceStats, TraceStatus, ExportFormat } from "@/lib/labeling/types";
import { StatsBar } from "@/components/labeling/StatsBar";
import { TraceRow } from "@/components/labeling/TraceRow";

interface LabelingClientProps {
  tenantId: string;
}

export function LabelingClient({ tenantId }: LabelingClientProps) {
  const router = useRouter();
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [stats, setStats] = useState<TraceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<string>("confidence");
  const [exportOpen, setExportOpen] = useState(false);

  const fetchTraces = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (sourceFilter !== "all") params.set("source", sourceFilter);
      if (search) params.set("search", search);
      params.set("sortBy", sortBy);
      params.set("limit", "50");

      const res = await fetch(`/api/labeling/traces?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTraces(data.traces);
        setTotal(data.total);
      }
    } catch (err) {
      console.error("Failed to fetch traces:", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, sourceFilter, search, sortBy]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/labeling/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  }, []);

  useEffect(() => {
    fetchTraces();
    fetchStats();
  }, [fetchTraces, fetchStats]);

  const handleExport = async (format: ExportFormat) => {
    setExportOpen(false);
    try {
      const res = await fetch(`/api/labeling/export?format=${format}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `labeled-traces-${format}-${new Date().toISOString().slice(0, 10)}.jsonl`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Failed to export:", err);
    }
  };

  // Collect unique sources from traces
  const allSources = [...new Set(traces.flatMap((t) => t.sources))].sort();

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="label mb-1">Data Labeling</div>
          <h1 className="text-xl font-semibold text-primary">Audit Queue</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Export dropdown */}
          <div className="relative">
            <button
              className="btn btn--secondary"
              onClick={() => setExportOpen(!exportOpen)}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Export
            </button>
            {exportOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 panel panel--elevated min-w-[200px]">
                  <div className="p-2 space-y-0.5">
                    <button
                      className="w-full text-left px-3 py-2 text-sm text-secondary hover:text-primary hover:bg-hover rounded-sm transition-colors"
                      onClick={() => handleExport("alpaca")}
                    >
                      <span className="block text-xs font-medium">Alpaca JSONL</span>
                      <span className="block text-[10px] text-tertiary">SFT — instruction tuning</span>
                    </button>
                    <button
                      className="w-full text-left px-3 py-2 text-sm text-secondary hover:text-primary hover:bg-hover rounded-sm transition-colors"
                      onClick={() => handleExport("sharegpt")}
                    >
                      <span className="block text-xs font-medium">ShareGPT JSONL</span>
                      <span className="block text-[10px] text-tertiary">Multi-turn conversation</span>
                    </button>
                    <button
                      className="w-full text-left px-3 py-2 text-sm text-secondary hover:text-primary hover:bg-hover rounded-sm transition-colors"
                      onClick={() => handleExport("dpo")}
                    >
                      <span className="block text-xs font-medium">DPO Pairs JSONL</span>
                      <span className="block text-[10px] text-tertiary">Preference optimization</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <StatsBar stats={stats} loading={loading && !stats} />

      {/* Filters */}
      <div className="panel">
        <div className="flex items-center gap-3 p-3 flex-wrap">
          {/* Status */}
          <select
            className="input text-sm w-auto min-w-[140px]"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="auto_labeled">Auto-Labeled</option>
            <option value="in_review">In Review</option>
            <option value="labeled">Labeled</option>
            <option value="skipped">Skipped</option>
          </select>

          {/* Source */}
          <select
            className="input text-sm w-auto min-w-[140px]"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
          >
            <option value="all">All Sources</option>
            {allSources.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* Sort */}
          <select
            className="input text-sm w-auto min-w-[160px]"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="confidence">Sort: Confidence ↑</option>
            <option value="date">Sort: Date</option>
            <option value="events">Sort: Event Count</option>
          </select>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-tertiary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              className="input input--search text-sm"
              placeholder="Search traces..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Result count */}
          <span className="font-mono text-[10px] text-tertiary tabular-nums shrink-0">
            {total} traces
          </span>
        </div>
      </div>

      {/* Trace list */}
      <div className="panel">
        <div className="panel__header">
          <span className="panel__title">Traces</span>
          <span className="font-mono text-[10px] text-tertiary">
            Sorted by lowest confidence first
          </span>
        </div>

        {loading ? (
          <div className="divide-y divide-border-dim">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-4 py-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-hover" />
                  <div className="h-3 w-32 bg-hover rounded animate-pulse" />
                  <div className="h-4 w-20 bg-hover rounded animate-pulse" />
                  <div className="ml-auto h-3 w-28 bg-hover rounded animate-pulse" />
                </div>
                <div className="flex items-center gap-3 ml-[18px]">
                  <div className="h-3 w-16 bg-hover rounded animate-pulse" />
                  <div className="h-3 w-20 bg-hover rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : traces.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <svg className="w-12 h-12 text-tertiary mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
            </svg>
            <p className="text-sm text-tertiary mb-1">No traces found</p>
            <p className="text-xs text-disabled">Try adjusting your filters</p>
          </div>
        ) : (
          <div>
            {traces.map((trace) => (
              <TraceRow
                key={trace.id}
                trace={trace}
                onClick={() => router.push(`/dashboard/labeling/${trace.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
