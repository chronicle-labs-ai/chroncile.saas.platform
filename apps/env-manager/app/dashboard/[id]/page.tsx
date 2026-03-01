"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import useSWR, { mutate as globalMutate } from "swr";
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
  _note?: string | null;
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

// ── Tenants & Orgs ────────────────────────────────────────────────────────────

interface Tenant {
  id: string;
  name: string;
  slug: string;
  stripeSubscriptionStatus: string | null;
  createdAt: string;
  userCount: number;
}

interface OrgUser {
  id: string;
  email: string;
  name: string | null;
  authProvider: string;
  createdAt: string;
}

function InviteModal({
  envId,
  tenant,
  onClose,
}: {
  envId: string;
  tenant: Tenant;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ loginUrl?: string; error?: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/${envId}/tenants/${tenant.id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: name || undefined }),
      });
      const data = await res.json();
      if (!res.ok) setResult({ error: data.error ?? "Invite failed" });
      else {
        setResult({ loginUrl: data.loginUrl });
        globalMutate(`/api/admin/${envId}/tenants`);
      }
    } catch (err) {
      setResult({ error: String(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-void/80 backdrop-blur-sm" />
      <div className="relative w-full max-w-md mx-4 panel">
        <div className="panel__header">
          <span className="panel__title">Invite to {tenant.name}</span>
          <button onClick={onClose} className="text-tertiary hover:text-primary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="panel__content">
          {!result?.loginUrl ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label block mb-1.5">Email</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input font-mono text-sm" placeholder="user@chronicle-labs.com" />
              </div>
              <div>
                <label className="label block mb-1.5">Name (optional)</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input text-sm" placeholder="John Smith" />
              </div>
              <p className="text-xs text-tertiary">
                Creates a Google OAuth account linked to <strong className="text-secondary">{tenant.name}</strong>. Share the login link with them.
              </p>
              {result?.error && <div className="flex items-center gap-2"><span className="status-dot status-dot--critical" /><span className="text-xs text-critical">{result.error}</span></div>}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={onClose} className="btn btn--secondary btn--sm">Cancel</button>
                <button type="submit" disabled={loading} className="btn btn--primary btn--sm disabled:opacity-40">{loading ? "Sending..." : "Send Invite"}</button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2"><span className="status-dot status-dot--nominal" /><span className="text-sm text-nominal">Account created</span></div>
              <div>
                <span className="label block mb-1.5">Share this login link</span>
                <div className="flex items-center gap-2 bg-elevated border border-border-default rounded-sm px-3 py-2">
                  <span className="font-mono text-xs text-data flex-1 truncate">{result.loginUrl}</span>
                  <button onClick={() => navigator.clipboard.writeText(result.loginUrl!)} className="text-tertiary hover:text-primary shrink-0" title="Copy">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" /></svg>
                  </button>
                </div>
              </div>
              <button onClick={onClose} className="btn btn--primary btn--sm w-full">Done</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function UsersDrawer({ envId, tenant, onClose, onInvite }: { envId: string; tenant: Tenant; onClose: () => void; onInvite: () => void }) {
  const { data } = useSWR<{ users: OrgUser[] }>(`/api/admin/${envId}/tenants/${tenant.id}/users`, fetcher);
  const users = data?.users ?? [];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-end" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-void/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm h-full bg-surface border-l border-border-dim flex flex-col">
        <div className="panel__header">
          <div>
            <span className="panel__title">{tenant.name}</span>
            <p className="font-mono text-[10px] text-tertiary mt-0.5">{tenant.slug}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onInvite} className="btn btn--primary btn--sm">Invite</button>
            <button onClick={onClose} className="text-tertiary hover:text-primary">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
        <div className="px-4 py-3 border-b border-border-dim bg-elevated">
          <div className="grid grid-cols-2 gap-4">
            <div><span className="label block mb-0.5">Users</span><span className="font-mono text-lg text-primary">{users.length}</span></div>
            <div><span className="label block mb-0.5">Subscription</span>
              <span className={`font-mono text-sm ${tenant.stripeSubscriptionStatus === "active" ? "text-nominal" : "text-caution"}`}>{tenant.stripeSubscriptionStatus ?? "free"}</span>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-2"><span className="label">Members</span></div>
          {users.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-tertiary">No users yet</div>
          ) : (
            <div className="divide-y divide-border-dim">
              {users.map((u) => (
                <div key={u.id} className="flex items-center gap-3 px-4 py-3 hover:bg-hover transition-colors">
                  <div className="w-8 h-8 rounded-full bg-data-bg border border-data-dim flex items-center justify-center shrink-0">
                    <span className="font-mono text-xs text-data">{(u.name ?? u.email)[0].toUpperCase()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    {u.name && <p className="text-sm text-primary truncate">{u.name}</p>}
                    <p className="font-mono text-xs text-tertiary truncate">{u.email}</p>
                  </div>
                  <span className="font-mono text-[9px] uppercase tracking-wider text-disabled shrink-0">{u.authProvider}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TenantsPanel({ envId }: { envId: string }) {
  const [expandedTenant, setExpandedTenant] = useState<Tenant | null>(null);
  const [inviteTenant, setInviteTenant] = useState<Tenant | null>(null);
  const [search, setSearch] = useState("");

  const { data, isLoading, mutate } = useSWR<{ tenants: Tenant[]; total: number; error?: string; pendingDeploy?: boolean }>(
    `/api/admin/${envId}/tenants`,
    fetcher,
    { refreshInterval: 60_000 }
  );

  const filtered = (data?.tenants ?? []).filter(
    (t) => t.name.toLowerCase().includes(search.toLowerCase()) || t.slug.toLowerCase().includes(search.toLowerCase())
  );
  const totalUsers = (data?.tenants ?? []).reduce((s, t) => s + t.userCount, 0);

  return (
    <>
      {expandedTenant && !inviteTenant && (
        <UsersDrawer envId={envId} tenant={expandedTenant} onClose={() => setExpandedTenant(null)} onInvite={() => setInviteTenant(expandedTenant)} />
      )}
      {inviteTenant && (
        <InviteModal envId={envId} tenant={inviteTenant} onClose={() => setInviteTenant(null)} />
      )}

      <div className="panel">
        <div className="panel__header">
          <div className="flex items-center gap-3">
            <span className="panel__title">Tenants & Organizations</span>
            <span className="font-mono text-[10px] text-tertiary">{data?.total ?? 0} orgs · {totalUsers} users</span>
          </div>
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="input font-mono text-xs pl-8 py-1.5 w-40" />
          </div>
        </div>

        {isLoading ? (
          <div className="divide-y divide-border-dim">
            {[1,2,3].map((i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <div className="w-8 h-8 rounded-sm bg-elevated animate-pulse" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-elevated rounded animate-pulse w-32" />
                  <div className="h-2.5 bg-elevated rounded animate-pulse w-20" />
                </div>
                <div className="h-3 bg-elevated rounded animate-pulse w-8" />
              </div>
            ))}
          </div>
        ) : data?.pendingDeploy ? (
          <div className="panel__content">
            <div className="flex items-start gap-3 p-3 bg-data-bg border border-data-dim rounded-sm">
              <svg className="w-4 h-4 text-data shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-data leading-relaxed">Tenant management is available once the backend is redeployed with the latest code.</p>
                <p className="text-[10px] text-data/70 mt-1">Push to the branch to trigger a redeploy, or redeploy manually in Fly.io.</p>
              </div>
            </div>
          </div>
        ) : data?.error ? (
          <div className="panel__content">
            <div className="flex items-start gap-3 p-3 bg-caution-bg border border-caution-dim rounded-sm">
              <span className="status-dot status-dot--caution mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-caution leading-relaxed">{data.error}</p>
                <p className="text-[10px] text-caution/70 mt-1">
                  If the machine just started, it may take 30–45s to be ready.
                </p>
              </div>
              <button
                onClick={() => mutate()}
                className="btn btn--secondary btn--sm shrink-0"
              >
                Retry
              </button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="panel__content text-center py-8 text-xs text-tertiary">
            {search ? `No orgs matching "${search}"` : "No organizations in this environment"}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Organization</th>
                <th>Slug</th>
                <th>Users</th>
                <th>Subscription</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((tenant) => (
                <tr key={tenant.id} className="cursor-pointer" onClick={() => setExpandedTenant(tenant)}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-sm bg-data-bg border border-data-dim flex items-center justify-center shrink-0">
                        <span className="font-mono text-xs text-data font-semibold">{tenant.name[0].toUpperCase()}</span>
                      </div>
                      <span className="text-primary font-medium">{tenant.name}</span>
                    </div>
                  </td>
                  <td><span className="font-mono text-xs">{tenant.slug}</span></td>
                  <td><span className="font-mono text-sm text-primary">{tenant.userCount}</span></td>
                  <td>
                    <span className={`badge ${tenant.stripeSubscriptionStatus === "active" ? "badge--nominal" : "badge--neutral"}`}>
                      {tenant.stripeSubscriptionStatus ?? "free"}
                    </span>
                  </td>
                  <td><span className="font-mono text-xs">{new Date(tenant.createdAt).toLocaleDateString()}</span></td>
                  <td>
                    <button
                      className="btn btn--secondary btn--sm"
                      onClick={(e) => { e.stopPropagation(); setExpandedTenant(tenant); setInviteTenant(tenant); }}
                    >
                      Invite
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

// ── Live Resources ────────────────────────────────────────────────────────────

interface FlyMachine {
  id: string;
  name: string;
  state: string;
  region: string;
  imageRef: string | null;
  cpus: number | null;
  memoryMb: number | null;
  updatedAt: string;
}

interface FlyVolume {
  id: string;
  name: string;
  state: string;
  sizeGb: number | null;
  region: string;
  encrypted: boolean;
  createdAt: string;
}

interface FlyIp {
  address: string;
  type: string;
  region: string;
  createdAt: string;
}

interface Resources {
  machines: FlyMachine[];
  volumes: FlyVolume[];
  ips: FlyIp[];
  postgres: { name: string; url: string } | null;
  errors: string[];
}

const MACHINE_STATE_DOT: Record<string, string> = {
  started: "status-dot--nominal",
  stopped: "status-dot--offline",
  created: "status-dot--data status-dot--pulse",
  error: "status-dot--critical",
};

function LiveResourcesPanel({ envId }: { envId: string }) {
  const { data, isLoading } = useSWR<Resources>(
    `/api/environments/${envId}/resources`,
    fetcher,
    { refreshInterval: 30_000 }
  );

  return (
    <div className="panel">
      <div className="panel__header">
        <span className="panel__title">Live Resources</span>
        {isLoading && (
          <div className="w-3 h-3 rounded-full border-2 border-border-bright border-t-data animate-spin" />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border-dim">
        {/* Machines */}
        <div className="bg-surface p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="label">Machines</span>
            <span className="font-mono text-[10px] text-tertiary">{data?.machines?.length ?? 0}</span>
          </div>
          {(data?.machines?.length ?? 0) === 0 ? (
            <p className="text-xs text-tertiary">None</p>
          ) : (
            <div className="space-y-2">
              {data!.machines.map((m) => (
                <div key={m.id} className="flex items-start gap-2">
                  <span className={`status-dot mt-1 shrink-0 ${MACHINE_STATE_DOT[m.state] ?? "status-dot--offline"}`} />
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-primary truncate">{m.name || m.id.slice(0, 12)}</p>
                    <p className="font-mono text-[10px] text-tertiary">
                      {m.region} · {m.cpus ?? "?"}vCPU · {m.memoryMb ?? "?"}MB
                    </p>
                    <p className="font-mono text-[10px] text-disabled">{m.state}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Volumes */}
        <div className="bg-surface p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="label">Volumes</span>
            <span className="font-mono text-[10px] text-tertiary">{data?.volumes?.length ?? 0}</span>
          </div>
          {(data?.volumes?.length ?? 0) === 0 ? (
            <p className="text-xs text-tertiary">None</p>
          ) : (
            <div className="space-y-2">
              {data!.volumes.map((v) => (
                <div key={v.id} className="flex items-start gap-2">
                  <svg className="w-3.5 h-3.5 text-tertiary shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" />
                  </svg>
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-primary truncate">{v.name}</p>
                    <p className="font-mono text-[10px] text-tertiary">
                      {v.region} · {v.sizeGb ?? "?"}GB{v.encrypted ? " · 🔒" : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* IPs + Postgres */}
        <div className="bg-surface p-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="label">IP Addresses</span>
              <span className="font-mono text-[10px] text-tertiary">{data?.ips?.length ?? 0}</span>
            </div>
            {(data?.ips?.length ?? 0) === 0 ? (
              <p className="text-xs text-tertiary">None allocated</p>
            ) : (
              <div className="space-y-1.5">
                {data!.ips.map((ip, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className={`font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${
                      ip.type === "v6" ? "bg-data-bg text-data" : "bg-caution-bg text-caution"
                    }`}>{ip.type}</span>
                    <span className="font-mono text-xs text-primary truncate">{ip.address}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {data?.postgres && (
            <div>
              <span className="label block mb-2">Postgres</span>
              <a
                href={data.postgres.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-data hover:underline"
              >
                {data.postgres.name}
              </a>
            </div>
          )}
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

// ── Resource Metrics Panel ─────────────────────────────────────────────────────

interface MachineMetrics {
  id: string;
  name: string;
  state: string;
  region: string;
  cpus: number | null;
  memoryMb: number | null;
}

function ResourceMetricsPanel({ envId }: { envId: string }) {
  const { data, isLoading } = useSWR<{
    machines: MachineMetrics[];
    volumes: Array<{ id: string; name: string; state: string; sizeGb: number | null; region: string }>;
    ips: Array<{ address: string; type: string }>;
    postgres: { name: string; url: string } | null;
  }>(
    `/api/environments/${envId}/resources`,
    fetcher,
    { refreshInterval: 15_000 }
  );

  const machines = data?.machines ?? [];
  const volumes = data?.volumes ?? [];
  const ips = data?.ips ?? [];

  return (
    <div className="space-y-6">
      {/* Machine metrics */}
      {machines.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {machines.map((m) => (
            <div key={m.id} className="panel">
              <div className="panel__header">
                <div className="flex items-center gap-2">
                  <span className={`status-dot ${m.state === "started" ? "status-dot--nominal status-dot--pulse" : "status-dot--offline"}`} />
                  <span className="panel__title">{m.name || m.id.slice(0, 12)}</span>
                </div>
                <span className="font-mono text-[10px] text-tertiary">{m.region}</span>
              </div>
              <div className="panel__content">
                <div className="grid grid-cols-2 gap-4">
                  <div className="metric">
                    <span className="metric__label">CPU</span>
                    <span className="metric__value text-lg">{m.cpus ?? "—"}</span>
                    <span className="text-[10px] text-tertiary">vCPUs (shared)</span>
                  </div>
                  <div className="metric">
                    <span className="metric__label">Memory</span>
                    <span className="metric__value text-lg">{m.memoryMb ?? "—"}</span>
                    <span className="text-[10px] text-tertiary">MB allocated</span>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-border-dim">
                  <div className="flex items-center justify-between">
                    <span className="label">State</span>
                    <span className={`font-mono text-xs ${m.state === "started" ? "text-nominal" : "text-caution"}`}>
                      {m.state}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1,2,3].map((i) => (
            <div key={i} className="panel"><div className="panel__content h-32 animate-pulse bg-elevated rounded" /></div>
          ))}
        </div>
      )}

      {/* Volumes + IPs + Postgres */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="panel">
          <div className="panel__header">
            <span className="panel__title">Volumes</span>
            <span className="font-mono text-[10px] text-tertiary">{volumes.length}</span>
          </div>
          <div className="panel__content">
            {volumes.length === 0 ? (
              <p className="text-xs text-tertiary">None</p>
            ) : (
              <div className="space-y-2">
                {volumes.map((v) => (
                  <div key={v.id} className="flex items-center justify-between">
                    <span className="font-mono text-xs text-primary">{v.name}</span>
                    <span className="font-mono text-xs text-tertiary">{v.sizeGb ?? "?"}GB · {v.region}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel__header">
            <span className="panel__title">IP Addresses</span>
            <span className="font-mono text-[10px] text-tertiary">{ips.length}</span>
          </div>
          <div className="panel__content">
            {ips.length === 0 ? (
              <p className="text-xs text-tertiary">None allocated</p>
            ) : (
              <div className="space-y-1.5">
                {ips.map((ip, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className={`font-mono text-[9px] uppercase px-1.5 py-0.5 rounded-sm ${ip.type === "v6" ? "bg-data-bg text-data" : "bg-caution-bg text-caution"}`}>{ip.type}</span>
                    <span className="font-mono text-xs text-primary truncate">{ip.address}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel__header">
            <span className="panel__title">Database</span>
          </div>
          <div className="panel__content">
            {data?.postgres ? (
              <a href={data.postgres.url} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-data hover:underline">
                {data.postgres.name}
              </a>
            ) : (
              <p className="text-xs text-tertiary">No Postgres attached</p>
            )}
          </div>
        </div>
      </div>

      {/* Health History */}
      <HealthHistoryPanel envId={envId} />
    </div>
  );
}

// ── Top-Level Tabs ────────────────────────────────────────────────────────────

type DetailTab = "deployment" | "users" | "resources";

const DETAIL_TABS: { id: DetailTab; label: string; icon: React.ReactNode }[] = [
  {
    id: "deployment",
    label: "Deployment",
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 010 1.954l-7.108 4.061A1.125 1.125 0 013 16.811V8.689zM12.75 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 010 1.954l-7.108 4.061a1.125 1.125 0 01-1.683-.977V8.689z" /></svg>,
  },
  {
    id: "users",
    label: "Users & Orgs",
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>,
  },
  {
    id: "resources",
    label: "Resources",
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" /></svg>,
  },
];

function EnvDetailTabs({ env, envId, stats, isProvisioning }: {
  env: EnvironmentRecord;
  envId: string;
  stats: Stats | undefined;
  isProvisioning: boolean;
}) {
  const [activeTab, setActiveTab] = useState<DetailTab>("deployment");

  return (
    <div>
      {/* Tab bar */}
      <div className="flex border-b border-border-dim mb-6">
        {DETAIL_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? "text-data border-data"
                : "text-tertiary hover:text-secondary border-transparent"
            }`}
          >
            <span className={activeTab === tab.id ? "text-data" : "text-tertiary"}>
              {tab.icon}
            </span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "deployment" && (
        <div className="space-y-6">
          {/* Endpoints */}
          <div className="panel">
            <div className="panel__header">
              <span className="panel__title">Endpoints</span>
            </div>
            <div className="divide-y divide-[var(--border-dim)]">
              <EndpointRow label="Backend" url={env.flyAppUrl} badge="Fly.io" badgeClass="bg-[#7c3aed]/20 text-[#a78bfa]" extra={env.flyAppUrl ? `${env.flyAppUrl}/health` : null} extraLabel="Health" />
              <EndpointRow label="Frontend" url={env.vercelUrl} badge="Vercel" badgeClass="bg-[#000]/30 text-[#e5e5e5]" pending={!env.vercelUrl && env.type === "EPHEMERAL"} pendingHint="Vercel preview will appear after the next branch push" extra={env.vercelUrl ? `${env.vercelUrl}/api/system/info` : null} extraLabel="Info" />
              {env.expiresAt && (
                <div className="flex items-center gap-4 px-4 py-3">
                  <span className="label shrink-0 w-20">Expires</span>
                  <span className="font-mono text-sm text-caution">{new Date(env.expiresAt).toLocaleString()}</span>
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
                  <span className="panel__title text-critical">{env.status === "ERROR" ? "Provisioning Error" : "Warnings"}</span>
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto bg-[var(--critical-bg)]">
                <pre className="px-4 py-3 text-xs font-mono text-critical/90 whitespace-pre-wrap break-all leading-relaxed">{env.errorLog}</pre>
              </div>
            </div>
          )}

          {/* Stats */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="label">Platform Metrics</span>
              {stats?._note && <span className="font-mono text-[10px] text-caution">{stats._note}</span>}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <StatCard label="Runs" value={stats?.runs ?? null} />
              <StatCard label="Connections" value={stats?.connections ?? null} />
              <StatCard label="Tenants" value={stats?.tenants ?? null} />
              <StatCard label="Users" value={stats?.users ?? null} />
              <StatCard label="Events" value={stats?.events ?? null} />
            </div>
          </div>

          {/* Logs */}
          <LogsPanel envId={envId} />
        </div>
      )}

      {activeTab === "users" && (
        <div className="space-y-6">
          {env.status === "RUNNING" && env.isHealthy ? (
            <TenantsPanel envId={envId} />
          ) : (
            <div className="panel">
              <div className="panel__content text-center py-8">
                <p className="text-sm text-secondary">Backend must be running and healthy to view tenants</p>
                <p className="text-xs text-tertiary mt-1">Current status: {env.status}{!env.isHealthy && " (unhealthy)"}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "resources" && (
        <div className="space-y-6">
          {env.status === "RUNNING" ? (
            <ResourceMetricsPanel envId={envId} />
          ) : (
            <div className="panel">
              <div className="panel__content text-center py-8">
                <p className="text-sm text-secondary">Resources available once environment is running</p>
              </div>
            </div>
          )}
        </div>
      )}
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

      {/* ═══ Top-level tabs ═══ */}
      <EnvDetailTabs env={env} envId={id} stats={stats} isProvisioning={isProvisioning} />
    </div>
    </>
  );
}
