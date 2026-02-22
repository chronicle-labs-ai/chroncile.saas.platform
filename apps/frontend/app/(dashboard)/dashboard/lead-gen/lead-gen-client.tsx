"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import type { LeadGenLead } from "@/lib/lead-gen-mock-data";

const SEARCH_DELAY_MS = 1200;

export function LeadGenClient() {
  const [leads, setLeads] = useState<LeadGenLead[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const runSearch = useCallback(async () => {
    setSearchLoading(true);
    setMessage(null);
    const delay = new Promise((resolve) => setTimeout(resolve, SEARCH_DELAY_MS));
    try {
      const [_, res] = await Promise.all([
        delay,
        fetch("/api/lead-gen/clay-search"),
      ]);
      if (!res.ok) throw new Error("Failed to load leads");
      const data = await res.json();
      setLeads(Array.isArray(data.leads) ? data.leads : []);
      if (!data.leads?.length) setMessage({ type: "success", text: "No leads returned." });
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Search failed" });
      setLeads([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const createRuns = useCallback(async () => {
    if (leads.length === 0) {
      setMessage({ type: "error", text: "Run search first to load leads." });
      return;
    }
    setCreateLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/lead-gen/create-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to create runs");
      const created = data?.created ?? 0;
      setMessage({ type: "success", text: `${created} run(s) created.` });
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Create runs failed" });
    } finally {
      setCreateLoading(false);
    }
  }, [leads]);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-tertiary tracking-wide uppercase mb-1">
          Lead gen (demo)
        </div>
        <h1 className="text-2xl font-semibold text-primary">Lead gen</h1>
        <p className="text-sm text-tertiary mt-1 max-w-xl">
          Simulates a search for CPG/D2C companies with large call centers exploring AI agents. Results are mock data. Create runs and process them with the outreach agent.
        </p>
      </div>

      <div className="panel">
        <div className="panel__header">
          <span className="panel__title">Demo leads</span>
        </div>
        <div className="panel__content space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={runSearch}
              disabled={searchLoading}
              className="btn btn--primary"
            >
              {searchLoading ? "Loading…" : "Run search"}
            </button>
            <button
              type="button"
              onClick={createRuns}
              disabled={createLoading || leads.length === 0}
              className="btn btn--secondary"
            >
              {createLoading ? "Creating…" : "Create runs from these leads"}
            </button>
          </div>
          {message && (
            <p className={`text-sm ${message.type === "success" ? "text-nominal" : "text-critical"}`}>
              {message.text}
            </p>
          )}
        </div>
      </div>

      {searchLoading && (
        <div className="panel">
          <div className="panel__header">
            <span className="panel__title">Searching…</span>
          </div>
          <div className="overflow-x-auto px-4 py-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-dim">
                  <th className="text-left py-3 px-4 font-medium text-secondary">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-secondary">Domain</th>
                  <th className="text-left py-3 px-4 font-medium text-secondary">Industry</th>
                  <th className="text-left py-3 px-4 font-medium text-secondary">Region</th>
                  <th className="text-left py-3 px-4 font-medium text-secondary">Call center</th>
                  <th className="text-left py-3 px-4 font-medium text-secondary">AI exploration</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <tr key={i} className="border-b border-border-dim">
                    <td className="py-3 px-4"><Skeleton className="h-4 w-36" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-4 w-28" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-4 w-12" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-4 w-24" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-4 w-14" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-4 w-20" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!searchLoading && leads.length > 0 && (
        <div className="panel">
          <div className="panel__header">
            <span className="panel__title">Results ({leads.length})</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-dim">
                  <th className="text-left py-3 px-4 font-medium text-secondary">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-secondary">Domain</th>
                  <th className="text-left py-3 px-4 font-medium text-secondary">Industry</th>
                  <th className="text-left py-3 px-4 font-medium text-secondary">Region</th>
                  <th className="text-left py-3 px-4 font-medium text-secondary">Call center</th>
                  <th className="text-left py-3 px-4 font-medium text-secondary">AI exploration</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-b border-border-dim hover:bg-hover">
                    <td className="py-3 px-4 text-primary">{lead.name}</td>
                    <td className="py-3 px-4 font-mono text-secondary text-xs">{lead.domain}</td>
                    <td className="py-3 px-4 text-secondary">{lead.industry}</td>
                    <td className="py-3 px-4 text-secondary">{lead.region}</td>
                    <td className="py-3 px-4 text-secondary">{lead.call_center_size}</td>
                    <td className="py-3 px-4 text-secondary">{lead.ai_agents_exploration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="panel border-border-default">
        <div className="panel__header">
          <span className="panel__title">Agent endpoint</span>
        </div>
        <div className="panel__content">
          <p className="text-sm text-tertiary mb-2">
            To process these runs with outreach drafts, set the Agent endpoint in Settings to the mock agent URL (e.g. <code className="px-1.5 py-0.5 bg-elevated font-mono text-xs">/api/mock-agent/outreach</code> or your full origin + this path). Then use &quot;Send pending to agent&quot; on the Runs page.
          </p>
          <Link href="/dashboard/settings" className="text-sm text-data hover:underline">
            Open Settings
          </Link>
        </div>
      </div>
    </div>
  );
}
