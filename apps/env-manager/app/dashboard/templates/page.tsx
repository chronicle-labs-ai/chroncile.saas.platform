"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import type { EnvironmentRecord } from "@/lib/types";
import { fetcher } from "@/lib/constants";

interface DbTemplate {
  id: string;
  name: string;
  description: string | null;
  mode: "FLY_DB" | "ENVIRONMENT" | "SEED_ONLY";
  flyDbName: string | null;
  sourceEnvId: string | null;
  seedSqlUrl: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

const MODE_LABELS: Record<string, string> = {
  FLY_DB: "Fly Postgres Fork",
  ENVIRONMENT: "Fork from Environment",
  SEED_ONLY: "Fresh DB + Seed SQL",
};

const MODE_BADGE: Record<string, string> = {
  FLY_DB: "badge--data",
  ENVIRONMENT: "badge--caution",
  SEED_ONLY: "badge--nominal",
};

interface SeedFile {
  name: string;
  filename: string;
  description: string;
  url: string;
}

function CreateTemplateModal({ envs, onClose, onCreated }: {
  envs: EnvironmentRecord[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { data: availableSeeds } = useSWR<SeedFile[]>("/api/seeds", fetcher);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<"FLY_DB" | "ENVIRONMENT" | "SEED_ONLY">("FLY_DB");
  const [flyDbName, setFlyDbName] = useState("");
  const [sourceEnvId, setSourceEnvId] = useState("");
  const [seedSqlUrl, setSeedSqlUrl] = useState("");
  const [seedSource, setSeedSource] = useState<"none" | "builtin" | "custom">("none");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/db-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, description: description || undefined, mode,
          flyDbName: mode === "FLY_DB" ? flyDbName : undefined,
          sourceEnvId: mode === "ENVIRONMENT" ? sourceEnvId : undefined,
          seedSqlUrl: seedSqlUrl || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to create template");
      }
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-void/80 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg mx-4 panel">
        <div className="panel__header">
          <span className="panel__title">New DB Template</span>
          <button onClick={onClose} className="text-tertiary hover:text-primary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="panel__content space-y-4">
            <div>
              <label className="label block mb-1.5">Template Name</label>
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="input font-mono text-sm" placeholder="demo-users" />
            </div>
            <div>
              <label className="label block mb-1.5">Description</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="input text-sm" placeholder="Pre-seeded with demo users and sample runs" />
            </div>

            <div>
              <label className="label block mb-2">Database Source</label>
              <div className="space-y-2">
                {(["FLY_DB", "ENVIRONMENT", "SEED_ONLY"] as const).map((m) => (
                  <label key={m} className={`flex items-start gap-3 p-3 rounded-sm border cursor-pointer transition-colors ${mode === m ? "border-data bg-data-bg" : "border-border-dim hover:border-border-bright"}`}>
                    <input type="radio" name="mode" checked={mode === m} onChange={() => setMode(m)} className="mt-0.5" />
                    <div>
                      <span className={`text-sm font-medium ${mode === m ? "text-data" : "text-primary"}`}>{MODE_LABELS[m]}</span>
                      <p className="text-[10px] text-tertiary mt-0.5">
                        {m === "FLY_DB" && "Fork from an existing Fly Postgres app"}
                        {m === "ENVIRONMENT" && "Fork from a running environment's database"}
                        {m === "SEED_ONLY" && "Create a fresh empty DB and run seed SQL"}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {mode === "FLY_DB" && (
              <div>
                <label className="label block mb-1.5">Fly Postgres App</label>
                <select
                  required
                  value={flyDbName}
                  onChange={(e) => setFlyDbName(e.target.value)}
                  className="input font-mono text-sm"
                >
                  <option value="">Select a Postgres app...</option>
                  {envs
                    .filter((e) => e.flyDbName)
                    .map((e) => (
                      <option key={e.flyDbName} value={e.flyDbName!}>
                        {e.flyDbName} — {e.name} ({e.type.toLowerCase()})
                      </option>
                    ))}
                </select>
                <p className="text-[10px] text-tertiary mt-1">
                  Or enter a custom Fly Postgres app name:
                </p>
                <input
                  type="text"
                  value={flyDbName}
                  onChange={(e) => setFlyDbName(e.target.value)}
                  className="input font-mono text-xs mt-1"
                  placeholder="custom-fly-postgres-app"
                />
              </div>
            )}

            {mode === "ENVIRONMENT" && (
              <div>
                <label className="label block mb-1.5">Source Environment</label>
                <select required value={sourceEnvId} onChange={(e) => setSourceEnvId(e.target.value)} className="input font-mono text-sm">
                  <option value="">Select environment...</option>
                  {envs.filter((e) => e.flyDbName).map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.type.toLowerCase()}) — {e.flyDbName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="label block mb-2">Seed SQL (optional)</label>
              <div className="space-y-2">
                <label className={`flex items-center gap-3 p-2.5 rounded-sm border cursor-pointer transition-colors ${seedSource === "none" ? "border-data bg-data-bg" : "border-border-dim hover:border-border-bright"}`}>
                  <input type="radio" name="seedSource" checked={seedSource === "none"} onChange={() => { setSeedSource("none"); setSeedSqlUrl(""); }} />
                  <span className={`text-sm ${seedSource === "none" ? "text-data" : "text-primary"}`}>No seed data</span>
                </label>

                {(availableSeeds ?? []).map((seed) => (
                  <label
                    key={seed.name}
                    className={`flex items-start gap-3 p-2.5 rounded-sm border cursor-pointer transition-colors ${seedSource === "builtin" && seedSqlUrl === seed.url ? "border-data bg-data-bg" : "border-border-dim hover:border-border-bright"}`}
                  >
                    <input
                      type="radio"
                      name="seedSource"
                      checked={seedSource === "builtin" && seedSqlUrl === seed.url}
                      onChange={() => { setSeedSource("builtin"); setSeedSqlUrl(seed.url); }}
                      className="mt-0.5"
                    />
                    <div>
                      <span className={`text-sm font-medium ${seedSource === "builtin" && seedSqlUrl === seed.url ? "text-data" : "text-primary"}`}>
                        {seed.name}
                      </span>
                      <p className="text-[10px] text-tertiary mt-0.5">{seed.description}</p>
                    </div>
                  </label>
                ))}

                <label className={`flex items-start gap-3 p-2.5 rounded-sm border cursor-pointer transition-colors ${seedSource === "custom" ? "border-data bg-data-bg" : "border-border-dim hover:border-border-bright"}`}>
                  <input type="radio" name="seedSource" checked={seedSource === "custom"} onChange={() => { setSeedSource("custom"); setSeedSqlUrl(""); }} className="mt-0.5" />
                  <div className="flex-1">
                    <span className={`text-sm ${seedSource === "custom" ? "text-data" : "text-primary"}`}>Custom URL</span>
                    {seedSource === "custom" && (
                      <input
                        type="url"
                        value={seedSqlUrl}
                        onChange={(e) => setSeedSqlUrl(e.target.value)}
                        className="input font-mono text-xs mt-2"
                        placeholder="https://raw.githubusercontent.com/.../seed.sql"
                      />
                    )}
                  </div>
                </label>
              </div>
            </div>

            {error && <div className="flex items-center gap-2"><span className="status-dot status-dot--critical" /><span className="text-xs text-critical">{error}</span></div>}
          </div>
          <div className="px-4 pb-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn btn--secondary btn--sm">Cancel</button>
            <button type="submit" disabled={loading} className="btn btn--primary btn--sm disabled:opacity-40">{loading ? "Creating..." : "Create Template"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const { data: templates, isLoading, mutate } = useSWR<DbTemplate[]>("/api/db-templates", fetcher);
  const { data: envs } = useSWR<EnvironmentRecord[]>("/api/environments", fetcher);
  const [showCreate, setShowCreate] = useState(false);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete template "${name}"?`)) return;
    await fetch(`/api/db-templates/${id}`, { method: "DELETE" });
    mutate();
  };

  return (
    <>
      {showCreate && (
        <CreateTemplateModal envs={envs ?? []} onClose={() => setShowCreate(false)} onCreated={() => mutate()} />
      )}
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-sans font-semibold">Database Templates</h1>
            <p className="text-xs text-tertiary mt-1">Pre-configured databases for ephemeral environments</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="btn btn--primary">New Template</button>
        </div>

        <div className="panel">
          <div className="panel__header">
            <span className="panel__title">Templates</span>
            <span className="font-mono text-[10px] text-tertiary">{templates?.length ?? 0}</span>
          </div>
          {isLoading ? (
            <div className="divide-y divide-border-dim">
              {[1,2].map((i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-4">
                  <div className="w-16 h-4 bg-elevated animate-pulse rounded" />
                  <div className="flex-1 h-4 bg-elevated animate-pulse rounded w-40" />
                  <div className="w-20 h-4 bg-elevated animate-pulse rounded" />
                </div>
              ))}
            </div>
          ) : (templates?.length ?? 0) === 0 ? (
            <div className="panel__content text-center py-8">
              <p className="text-sm text-secondary mb-3">No templates yet</p>
              <button onClick={() => setShowCreate(true)} className="btn btn--secondary btn--sm">Create your first template</button>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Mode</th>
                  <th>Source</th>
                  <th>Seed SQL</th>
                  <th>Last Used</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {templates!.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <div>
                        <span className="text-primary font-medium">{t.name}</span>
                        {t.description && <p className="text-[10px] text-tertiary mt-0.5">{t.description}</p>}
                      </div>
                    </td>
                    <td><span className={`badge ${MODE_BADGE[t.mode]}`}>{MODE_LABELS[t.mode]}</span></td>
                    <td><span className="font-mono text-xs">{t.flyDbName ?? t.sourceEnvId?.slice(0, 12) ?? "—"}</span></td>
                    <td>
                      {t.seedSqlUrl ? <span className="status-dot status-dot--nominal" title={t.seedSqlUrl} /> : <span className="text-tertiary">—</span>}
                    </td>
                    <td><span className="font-mono text-xs">{t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleDateString() : "never"}</span></td>
                    <td>
                      <button onClick={() => handleDelete(t.id, t.name)} className="text-tertiary hover:text-critical text-xs font-mono uppercase tracking-wider">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
