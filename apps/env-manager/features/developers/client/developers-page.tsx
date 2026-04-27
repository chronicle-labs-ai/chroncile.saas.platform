"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/shared/fetcher";

interface Developer {
  id: string;
  name: string;
  email: string | null;
  tunnelDomain: string;
  dopplerSuffix: string;
  createdAt: string;
}

export function DevelopersPage() {
  const {
    data: developers,
    isLoading,
    mutate,
  } = useSWR<Developer[]>("/api/developers", fetcher);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [tunnelDomain, setTunnelDomain] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/developers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email: email || undefined, tunnelDomain }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to add developer");
      } else {
        setShowForm(false);
        setName("");
        setEmail("");
        setTunnelDomain("");
        mutate();
      }
    } catch {
      setError("Request failed");
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string, devName: string) => {
    if (
      !confirm(
        `Remove developer "${devName}"? This will delete their Doppler branch configs.`
      )
    )
      return;
    setDeletingId(id);
    await fetch(`/api/developers/${id}`, { method: "DELETE" });
    mutate();
    setDeletingId(null);
  };

  const handleNameChange = (value: string) => {
    setName(value);
    const safe = value.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (
      !tunnelDomain ||
      tunnelDomain ===
        `${name.toLowerCase().replace(/[^a-z0-9]/g, "")}.chronicle-labs.com`
    ) {
      setTunnelDomain(`${safe}.chronicle-labs.com`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-sans font-semibold">Developers</h1>
          <p className="text-xs text-tertiary mt-1">
            Manage developer environments, tunnel domains, and Doppler configs
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn btn--primary"
        >
          {showForm ? "Cancel" : "Add Developer"}
        </button>
      </div>

      {showForm && (
        <div className="panel">
          <div className="panel__header">
            <span className="panel__title">New Developer</span>
          </div>
          <form onSubmit={handleAdd} className="panel__content space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label block mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="ernesto"
                  required
                  className="w-full px-3 py-2 bg-elevated border border-border-dim rounded text-sm font-mono text-primary placeholder:text-disabled focus:outline-none focus:border-data"
                />
                <p className="text-[10px] text-tertiary mt-1">
                  Used for Doppler configs and Makefile
                </p>
              </div>
              <div>
                <label className="label block mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ernesto@chronicle-labs.com"
                  className="w-full px-3 py-2 bg-elevated border border-border-dim rounded text-sm font-mono text-primary placeholder:text-disabled focus:outline-none focus:border-data"
                />
              </div>
              <div>
                <label className="label block mb-1">Tunnel Domain</label>
                <input
                  type="text"
                  value={tunnelDomain}
                  onChange={(e) => setTunnelDomain(e.target.value)}
                  placeholder="ernesto.chronicle-labs.com"
                  required
                  className="w-full px-3 py-2 bg-elevated border border-border-dim rounded text-sm font-mono text-primary placeholder:text-disabled focus:outline-none focus:border-data"
                />
              </div>
            </div>

            {error && (
              <p className="text-xs text-critical font-mono">{error}</p>
            )}

            <div className="flex items-center gap-3 pt-2 border-t border-border-dim">
              <button
                type="submit"
                disabled={submitting}
                className="btn btn--primary btn--sm disabled:opacity-40"
              >
                {submitting ? "Creating..." : "Create Developer"}
              </button>
              <p className="text-[10px] text-tertiary">
                Creates Doppler branch configs{" "}
                <span className="font-mono text-secondary">
                  dev_frontend_
                  {name.toLowerCase().replace(/[^a-z0-9]/g, "") || "name"}
                </span>{" "}
                and{" "}
                <span className="font-mono text-secondary">
                  dev_backend_
                  {name.toLowerCase().replace(/[^a-z0-9]/g, "") || "name"}
                </span>
              </p>
            </div>
          </form>
        </div>
      )}

      <div className="panel">
        <div className="panel__header">
          <span className="panel__title">Registered Developers</span>
          <span className="font-mono text-[10px] text-tertiary">
            {developers?.length ?? 0} developer
            {(developers?.length ?? 0) !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="panel__content">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-secondary font-mono">
              Loading...
            </div>
          ) : !developers || developers.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-secondary">No developers registered</p>
              <p className="text-xs text-tertiary mt-1">
                Add a developer to create their Doppler configs and tunnel
                domain
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border-dim">
                    <th className="text-left py-2 pr-4 label">Name</th>
                    <th className="text-left py-2 pr-4 label">Email</th>
                    <th className="text-left py-2 pr-4 label">Tunnel Domain</th>
                    <th className="text-left py-2 pr-4 label">
                      Doppler Configs
                    </th>
                    <th className="text-left py-2 pr-4 label">Command</th>
                    <th className="text-right py-2 label">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {developers.map((dev) => (
                    <tr
                      key={dev.id}
                      className="border-b border-border-dim last:border-0"
                    >
                      <td className="py-3 pr-4 font-mono text-data font-medium">
                        {dev.name}
                      </td>
                      <td className="py-3 pr-4 font-mono text-secondary">
                        {dev.email ?? "—"}
                      </td>
                      <td className="py-3 pr-4 font-mono text-primary">
                        {dev.tunnelDomain}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="space-y-0.5">
                          <span className="badge badge--data font-mono text-[10px]">
                            dev_frontend_{dev.dopplerSuffix}
                          </span>
                          <span className="badge badge--neutral font-mono text-[10px] ml-1">
                            dev_backend_{dev.dopplerSuffix}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <code className="font-mono text-[10px] text-secondary bg-elevated px-1.5 py-0.5 rounded">
                          make dev-all DEV_USER={dev.name}
                        </code>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => handleDelete(dev.id, dev.name)}
                          disabled={deletingId === dev.id}
                          className="btn btn--critical btn--sm disabled:opacity-40"
                        >
                          {deletingId === dev.id ? "Removing..." : "Remove"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel__header">
          <span className="panel__title">Quick Start</span>
        </div>
        <div className="panel__content space-y-3">
          <div className="text-xs text-secondary space-y-2">
            <p className="font-medium text-primary">For each developer:</p>
            <ol className="list-decimal list-inside space-y-1.5">
              <li>Add them above with their ngrok tunnel domain</li>
              <li>
                Reserve the domain in{" "}
                <a
                  href="https://dashboard.ngrok.com/domains"
                  className="text-data hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  ngrok dashboard
                </a>
              </li>
              <li>
                Add Google OAuth redirect URI:{" "}
                <code className="font-mono text-[10px] bg-elevated px-1 py-0.5 rounded">
                  https://DOMAIN/api/auth/callback/google
                </code>
              </li>
              <li>
                Run:{" "}
                <code className="font-mono text-[10px] bg-elevated px-1 py-0.5 rounded">
                  make dev-all DEV_USER=name
                </code>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
