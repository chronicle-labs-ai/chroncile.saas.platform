"use client";

import { useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import type { Tenant, OrgUser } from "@/lib/types";
import { fetcher } from "@/lib/constants";
import { ModalOverlay, ModalHeader, InviteResultBanner, LoginLinkDisplay } from "@/components/ui/modal-overlay";

// ── Invite Modal ─────────────────────────────────────────────────────────────

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
  const [sendEmail, setSendEmail] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ loginUrl?: string; emailSent?: boolean; emailError?: string | null; error?: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/${envId}/tenants/${tenant.id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: name || undefined, sendEmail }),
      });
      const data = await res.json();
      if (!res.ok) setResult({ error: data.error ?? "Invite failed" });
      else {
        setResult({ loginUrl: data.loginUrl, emailSent: data.emailSent, emailError: data.emailError });
        globalMutate(`/api/admin/${envId}/tenants`);
      }
    } catch (err) {
      setResult({ error: String(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalOverlay onClose={onClose}>
      <ModalHeader title={`Invite to ${tenant.name}`} onClose={onClose} />
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
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="rounded border-border-bright bg-elevated text-data focus:ring-data" />
              <span className="text-xs text-secondary">Send invite email via Resend</span>
            </label>
            {result?.error && <div className="flex items-center gap-2"><span className="status-dot status-dot--critical" /><span className="text-xs text-critical">{result.error}</span></div>}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="btn btn--secondary btn--sm">Cancel</button>
              <button type="submit" disabled={loading} className="btn btn--primary btn--sm disabled:opacity-40">{loading ? "Sending..." : "Send Invite"}</button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2"><span className="status-dot status-dot--nominal" /><span className="text-sm text-nominal">Account created</span></div>
            <InviteResultBanner email={email} emailSent={result.emailSent} emailError={result.emailError} />
            <LoginLinkDisplay loginUrl={result.loginUrl} />
            <button onClick={onClose} className="btn btn--primary btn--sm w-full">Done</button>
          </div>
        )}
      </div>
    </ModalOverlay>
  );
}

// ── Create Org Modal ─────────────────────────────────────────────────────────

function CreateOrgModal({
  envId,
  onClose,
}: {
  envId: string;
  onClose: () => void;
}) {
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    loginUrl?: string;
    emailSent?: boolean;
    emailError?: string | null;
    tenant?: { name: string };
    error?: string;
  } | null>(null);

  const deriveSlug = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const handleNameChange = (value: string) => {
    setOrgName(value);
    if (!orgSlug || orgSlug === deriveSlug(orgName)) {
      setOrgSlug(deriveSlug(value));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/${envId}/orgs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgName,
          orgSlug: orgSlug || deriveSlug(orgName),
          adminEmail: email,
          adminName: name || undefined,
          sendEmail,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ error: data.error ?? "Failed to create organization" });
      } else {
        setResult({
          loginUrl: data.loginUrl,
          emailSent: data.emailSent,
          emailError: data.emailError,
          tenant: data.tenant,
        });
        globalMutate(`/api/admin/${envId}/tenants`);
      }
    } catch (err) {
      setResult({ error: String(err) });
    } finally {
      setLoading(false);
    }
  };

  const orgIcon = (
    <svg className="w-4 h-4 text-data" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21" />
    </svg>
  );

  return (
    <ModalOverlay onClose={onClose} maxWidth="max-w-lg">
      <ModalHeader title="Create Organization" icon={orgIcon} onClose={onClose} />
      <div className="panel__content">
        {!result?.loginUrl ? (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-5 h-5 rounded-full bg-data-bg border border-data-dim flex items-center justify-center shrink-0">
                  <span className="font-mono text-[10px] text-data font-semibold">1</span>
                </span>
                <span className="label">Organization Details</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label block mb-1.5">Organization Name</label>
                  <input type="text" required value={orgName} onChange={(e) => handleNameChange(e.target.value)} className="input text-sm" placeholder="Acme Inc." />
                </div>
                <div>
                  <label className="label block mb-1.5">Slug</label>
                  <input type="text" required value={orgSlug} onChange={(e) => setOrgSlug(e.target.value)} className="input font-mono text-sm" placeholder="acme-inc" pattern="[a-z0-9\-]+" title="Lowercase letters, numbers, and hyphens only" />
                </div>
              </div>
            </div>

            <div className="border-t border-border-dim pt-4 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-5 h-5 rounded-full bg-data-bg border border-data-dim flex items-center justify-center shrink-0">
                  <span className="font-mono text-[10px] text-data font-semibold">2</span>
                </span>
                <span className="label">Admin User</span>
              </div>
              <div>
                <label className="label block mb-1.5">Email</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input font-mono text-sm" placeholder="admin@acme.com" />
              </div>
              <div>
                <label className="label block mb-1.5">Name (optional)</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input text-sm" placeholder="Jane Doe" />
              </div>
            </div>

            <div className="border-t border-border-dim pt-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="rounded border-border-bright bg-elevated text-data focus:ring-data" />
                <span className="text-xs text-secondary">Send invite email to admin user</span>
              </label>
              <p className="text-[10px] text-tertiary mt-1.5 ml-6">
                Uses Resend to deliver a branded invitation with a login link.
              </p>
            </div>

            {result?.error && (
              <div className="flex items-center gap-2 p-2 bg-critical-bg border border-critical-dim rounded-sm">
                <span className="status-dot status-dot--critical shrink-0" />
                <span className="text-xs text-critical">{result.error}</span>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="btn btn--secondary btn--sm">Cancel</button>
              <button type="submit" disabled={loading} className="btn btn--primary btn--sm disabled:opacity-40">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full border-2 border-data/40 border-t-data animate-spin" />
                    Creating...
                  </span>
                ) : "Create & Invite"}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="status-dot status-dot--nominal" />
              <span className="text-sm text-nominal">
                Organization <strong>{result.tenant?.name}</strong> created
              </span>
            </div>
            <InviteResultBanner email={email} emailSent={result.emailSent} emailError={result.emailError} />
            <LoginLinkDisplay loginUrl={result.loginUrl!} />
            <button onClick={onClose} className="btn btn--primary btn--sm w-full">Done</button>
          </div>
        )}
      </div>
    </ModalOverlay>
  );
}

// ── Users Drawer ─────────────────────────────────────────────────────────────

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

// ── Tenants Panel (exported) ─────────────────────────────────────────────────

export function TenantsPanel({ envId }: { envId: string }) {
  const [expandedTenant, setExpandedTenant] = useState<Tenant | null>(null);
  const [inviteTenant, setInviteTenant] = useState<Tenant | null>(null);
  const [showCreateOrg, setShowCreateOrg] = useState(false);
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
      {showCreateOrg && (
        <CreateOrgModal envId={envId} onClose={() => setShowCreateOrg(false)} />
      )}

      <div className="panel">
        <div className="panel__header">
          <div className="flex items-center gap-3">
            <span className="panel__title">Tenants & Organizations</span>
            <span className="font-mono text-[10px] text-tertiary">{data?.total ?? 0} orgs · {totalUsers} users</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="input font-mono text-xs pl-8 py-1.5 w-40" />
            </div>
            <button onClick={() => setShowCreateOrg(true)} className="btn btn--primary btn--sm flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              Create Org
            </button>
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
                <p className="text-[10px] text-caution/70 mt-1">If the machine just started, it may take 30–45s to be ready.</p>
              </div>
              <button onClick={() => mutate()} className="btn btn--secondary btn--sm shrink-0">Retry</button>
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
