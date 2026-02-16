"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import type { Sandbox, SandboxStatus } from "@/components/sandbox/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const STATUS_STYLES: Record<
  SandboxStatus,
  { dot: string; text: string; bg: string; border: string }
> = {
  active: {
    dot: "bg-nominal shadow-[0_0_8px_theme(colors.nominal.DEFAULT)]",
    text: "text-nominal",
    bg: "bg-nominal-bg",
    border: "border-nominal-dim",
  },
  draft: {
    dot: "bg-caution shadow-[0_0_8px_theme(colors.caution.DEFAULT)]",
    text: "text-caution",
    bg: "bg-caution-bg",
    border: "border-caution-dim",
  },
  archived: {
    dot: "bg-tertiary",
    text: "text-tertiary",
    bg: "bg-elevated",
    border: "border-border-dim",
  },
};

export function SandboxListClient({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const { data, mutate, isLoading } = useSWR<{ sandboxes: Sandbox[] }>(
    "/api/sandbox",
    fetcher,
    { refreshInterval: 10_000 }
  );

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() }),
      });
      if (res.ok) {
        const { sandbox } = await res.json();
        mutate();
        setShowCreateModal(false);
        setNewName("");
        setNewDesc("");
        router.push(`/dashboard/sandbox/${sandbox.id}`);
      }
    } finally {
      setCreating(false);
    }
  }, [newName, newDesc, mutate, router]);

  const sandboxes = data?.sandboxes ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-tertiary tracking-wide uppercase mb-1">
            Agent Testing
          </div>
          <h1 className="text-2xl font-semibold text-primary">Sandboxes</h1>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn--primary"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
          Create Sandbox
        </button>
      </div>

      {/* Status Banner */}
      <div className="panel">
        <div className="flex items-center justify-between px-4 py-3 bg-data-bg border-b border-data-dim">
          <div className="flex items-center gap-2">
            <div className="status-dot status-dot--nominal status-dot--pulse" />
            <span className="font-mono text-[10px] font-medium tracking-wider text-data uppercase">
              Sandbox Environment
            </span>
          </div>
          <span className="font-mono text-[10px] text-tertiary tabular-nums">
            {sandboxes.length} sandbox{sandboxes.length !== 1 ? "es" : ""}
          </span>
        </div>
      </div>

      {/* Sandbox Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="panel animate-pulse">
              <div className="p-4 space-y-3">
                <div className="h-4 bg-elevated rounded w-3/4" />
                <div className="h-3 bg-elevated rounded w-full" />
                <div className="h-3 bg-elevated rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : sandboxes.length === 0 ? (
        <div className="panel">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <svg
              className="w-12 h-12 text-tertiary mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 5.607A1.125 1.125 0 0120.108 22H3.893a1.125 1.125 0 01-1.093-1.393L4.2 15.3"
              />
            </svg>
            <p className="text-secondary text-sm mb-1">
              No sandboxes yet
            </p>
            <p className="text-tertiary text-xs">
              Create your first sandbox to start building event pipelines
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sandboxes.map((sbx) => {
            const style = STATUS_STYLES[sbx.status];
            return (
              <button
                key={sbx.id}
                onClick={() => router.push(`/dashboard/sandbox/${sbx.id}`)}
                className="panel text-left transition-all duration-fast hover:border-border-bright hover:bg-hover group"
              >
                <div className="p-4 space-y-3">
                  {/* Title row */}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-medium text-primary group-hover:text-data transition-colors">
                      {sbx.name}
                    </h3>
                    <span
                      className={`badge ${style.bg} ${style.text} ${style.border} shrink-0`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                      {sbx.status}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-secondary line-clamp-2 leading-relaxed">
                    {sbx.description || "No description"}
                  </p>

                  {/* Meta row */}
                  <div className="flex items-center gap-4 pt-1 border-t border-border-dim">
                    <span className="font-mono text-[10px] text-tertiary">
                      {sbx.nodes.length} node{sbx.nodes.length !== 1 ? "s" : ""}
                    </span>
                    <span className="font-mono text-[10px] text-tertiary">
                      {sbx.edges.length} edge{sbx.edges.length !== 1 ? "s" : ""}
                    </span>
                    <span className="font-mono text-[10px] text-tertiary ml-auto tabular-nums">
                      {new Date(sbx.updatedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="panel panel--elevated w-full max-w-md">
            <div className="panel__header">
              <span className="panel__title">Create Sandbox</span>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-tertiary hover:text-primary transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-[10px] font-medium tracking-wider text-tertiary uppercase mb-1.5">
                  Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Customer Support Replay"
                  className="w-full px-3 py-2 bg-base border border-border-default rounded text-sm text-primary placeholder:text-disabled focus:outline-none focus:border-data transition-colors"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                  }}
                />
              </div>

              <div>
                <label className="block text-[10px] font-medium tracking-wider text-tertiary uppercase mb-1.5">
                  Description
                </label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Describe what this sandbox will test..."
                  rows={3}
                  className="w-full px-3 py-2 bg-base border border-border-default rounded text-sm text-primary placeholder:text-disabled focus:outline-none focus:border-data transition-colors resize-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn--secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim() || creating}
                  className="btn btn--primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {creating ? (
                    <span className="flex items-center gap-2">
                      <svg
                        className="w-3.5 h-3.5 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Creating...
                    </span>
                  ) : (
                    "Create"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
