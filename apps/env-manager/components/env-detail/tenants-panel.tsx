"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import useSWR, { mutate as globalMutate } from "swr";
import { Button, Checkbox, FormField, Input } from "ui";
import {
  createOrgSchema,
  inviteUserSchema,
  type CreateOrgInput,
  type InviteUserInput,
} from "@/shared/forms/schemas";
import type {
  OrgUser,
  Tenant,
  TenantFeatureAccessResponse,
} from "@/shared/types";
import { fetcher } from "@/shared/fetcher";
import { ModalOverlay, ModalHeader, InviteResultBanner, LoginLinkDisplay } from "@/shared/components/modal-overlay";

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
  const [result, setResult] = useState<{ loginUrl?: string; emailSent?: boolean; emailError?: string | null; error?: string } | null>(null);

  const form = useForm<InviteUserInput>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: {
      email: "",
      name: "",
      sendEmail: true,
    },
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    setResult(null);
    try {
      const res = await fetch(`/api/admin/${envId}/tenants/${tenant.id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: values.email,
          name: values.name || undefined,
          sendEmail: values.sendEmail,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        form.setError("root", { message: data.error ?? "Invite failed" });
      }
      else {
        setResult({ loginUrl: data.loginUrl, emailSent: data.emailSent, emailError: data.emailError });
        globalMutate(`/api/admin/${envId}/tenants`);
      }
    } catch (err) {
      form.setError("root", {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  return (
    <ModalOverlay onClose={onClose}>
      <ModalHeader title={`Invite to ${tenant.name}`} onClose={onClose} />
      <div className="panel__content">
        {!result?.loginUrl ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField
              label="Email"
              htmlFor="invite-email"
              error={form.formState.errors.email?.message}
            >
              <Input
                id="invite-email"
                type="email"
                className="font-mono text-sm"
                placeholder="user@chronicle-labs.com"
                invalid={!!form.formState.errors.email}
                {...form.register("email")}
              />
            </FormField>
            <FormField label="Name (optional)" htmlFor="invite-name">
              <Input
                id="invite-name"
                type="text"
                className="text-sm"
                placeholder="John Smith"
                {...form.register("name")}
              />
            </FormField>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox {...form.register("sendEmail")} />
              <span className="text-xs text-secondary">Send invite email via Resend</span>
            </label>
            {form.formState.errors.root?.message && (
              <div className="flex items-center gap-2">
                <span className="status-dot status-dot--critical" />
                <span className="text-xs text-critical">{form.formState.errors.root.message}</span>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" size="sm" onClick={onClose}>Cancel</Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? "Sending..." : "Send Invite"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2"><span className="status-dot status-dot--nominal" /><span className="text-sm text-nominal">Account created</span></div>
            <InviteResultBanner email={form.getValues("email")} emailSent={result.emailSent} emailError={result.emailError} />
            <LoginLinkDisplay loginUrl={result.loginUrl} />
            <Button onClick={onClose} variant="primary" size="sm" className="w-full">Done</Button>
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
  const [result, setResult] = useState<{
    loginUrl?: string;
    emailSent?: boolean;
    emailError?: string | null;
    tenant?: { name: string };
    error?: string;
  } | null>(null);

  const deriveSlug = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const form = useForm<CreateOrgInput>({
    resolver: zodResolver(createOrgSchema),
    defaultValues: {
      orgName: "",
      orgSlug: "",
      adminEmail: "",
      adminName: "",
      sendEmail: true,
    },
  });

  const orgName = form.watch("orgName");
  const orgSlug = form.watch("orgSlug");

  const handleNameChange = (value: string) => {
    const currentName = form.getValues("orgName");
    const currentSlug = form.getValues("orgSlug");

    form.setValue("orgName", value, {
      shouldDirty: true,
      shouldValidate: true,
    });

    if (!currentSlug || currentSlug === deriveSlug(currentName)) {
      form.setValue("orgSlug", deriveSlug(value), {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    setResult(null);
    try {
      const res = await fetch(`/api/admin/${envId}/orgs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgName: values.orgName,
          orgSlug: values.orgSlug || deriveSlug(values.orgName),
          adminEmail: values.adminEmail,
          adminName: values.adminName || undefined,
          sendEmail: values.sendEmail,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        form.setError("root", {
          message: data.error ?? "Failed to create organization",
        });
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
      form.setError("root", {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

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
                <FormField
                  label="Organization Name"
                  htmlFor="org-name"
                  error={form.formState.errors.orgName?.message}
                >
                  <Input
                    id="org-name"
                    type="text"
                    className="text-sm"
                    placeholder="Acme Inc."
                    invalid={!!form.formState.errors.orgName}
                    value={orgName}
                    onChange={(e) => handleNameChange(e.target.value)}
                  />
                </FormField>
                <FormField
                  label="Slug"
                  htmlFor="org-slug"
                  error={form.formState.errors.orgSlug?.message}
                >
                  <Input
                    id="org-slug"
                    type="text"
                    className="font-mono text-sm"
                    placeholder="acme-inc"
                    invalid={!!form.formState.errors.orgSlug}
                    {...form.register("orgSlug")}
                  />
                </FormField>
              </div>
            </div>

            <div className="border-t border-border-dim pt-4 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-5 h-5 rounded-full bg-data-bg border border-data-dim flex items-center justify-center shrink-0">
                  <span className="font-mono text-[10px] text-data font-semibold">2</span>
                </span>
                <span className="label">Admin User</span>
              </div>
              <FormField
                label="Email"
                htmlFor="admin-email"
                error={form.formState.errors.adminEmail?.message}
              >
                <Input
                  id="admin-email"
                  type="email"
                  className="font-mono text-sm"
                  placeholder="admin@acme.com"
                  invalid={!!form.formState.errors.adminEmail}
                  {...form.register("adminEmail")}
                />
              </FormField>
              <FormField label="Name (optional)" htmlFor="admin-name">
                <Input
                  id="admin-name"
                  type="text"
                  className="text-sm"
                  placeholder="Jane Doe"
                  {...form.register("adminName")}
                />
              </FormField>
            </div>

            <div className="border-t border-border-dim pt-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox {...form.register("sendEmail")} />
                <span className="text-xs text-secondary">Send invite email to admin user</span>
              </label>
              <p className="text-[10px] text-tertiary mt-1.5 ml-6">
                Uses Resend to deliver a branded invitation with a login link.
              </p>
            </div>

            {form.formState.errors.root?.message && (
              <div className="flex items-center gap-2 p-2 bg-critical-bg border border-critical-dim rounded-sm">
                <span className="status-dot status-dot--critical shrink-0" />
                <span className="text-xs text-critical">{form.formState.errors.root.message}</span>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" size="sm" onClick={onClose}>Cancel</Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? "Creating..." : "Create & Invite"}
              </Button>
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
            <InviteResultBanner email={form.getValues("adminEmail")} emailSent={result.emailSent} emailError={result.emailError} />
            <LoginLinkDisplay loginUrl={result.loginUrl!} />
            <Button onClick={onClose} variant="primary" size="sm" className="w-full">Done</Button>
          </div>
        )}
      </div>
    </ModalOverlay>
  );
}

// ── Feature Flags Modal ──────────────────────────────────────────────────────

function FeatureFlagsModal({
  envId,
  tenant,
  onClose,
}: {
  envId: string;
  tenant: Tenant;
  onClose: () => void;
}) {
  const [busyFlagKey, setBusyFlagKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data, isLoading, mutate } = useSWR<
    (TenantFeatureAccessResponse & { error?: string }) | null
  >(`/api/admin/${envId}/tenants/${tenant.id}/feature-access`, fetcher);

  const toggleFlag = async (flagKey: string, enabled: boolean) => {
    setBusyFlagKey(flagKey);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/${envId}/tenants/${tenant.id}/feature-flags/${flagKey}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled }),
        },
      );
      const nextData = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(nextData.error ?? "Failed to update feature flag");
        return;
      }
      await mutate(nextData, { revalidate: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyFlagKey(null);
    }
  };

  const resetFlag = async (flagKey: string) => {
    setBusyFlagKey(flagKey);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/${envId}/tenants/${tenant.id}/feature-flags/${flagKey}`,
        { method: "DELETE" },
      );
      const nextData = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(nextData.error ?? "Failed to reset feature flag override");
        return;
      }
      await mutate(nextData, { revalidate: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyFlagKey(null);
    }
  };

  const overrides = data?.overrides ?? [];
  const hasOverride = (flagKey: string) =>
    overrides.some((override) => override.flagKey === flagKey);

  return (
    <ModalOverlay onClose={onClose} maxWidth="max-w-4xl">
      <ModalHeader title={`Feature Flags · ${tenant.name}`} onClose={onClose} />
      <div className="panel__content space-y-5">
        {isLoading ? (
          <div className="space-y-3">
            <div className="h-20 rounded-sm bg-elevated animate-pulse" />
            <div className="h-56 rounded-sm bg-elevated animate-pulse" />
          </div>
        ) : data?.error ? (
          <div className="flex items-start gap-3 p-3 bg-critical-bg border border-critical-dim rounded-sm">
            <span className="status-dot status-dot--critical mt-0.5 shrink-0" />
            <p className="text-xs text-critical leading-relaxed">{data.error}</p>
          </div>
        ) : !data ? (
          <div className="text-xs text-tertiary">No feature access data available.</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="panel">
                <div className="panel__header">
                  <span className="panel__title">Plan</span>
                </div>
                <div className="panel__content">
                  <span className="badge badge--data font-mono">
                    {data.access.planId}
                  </span>
                </div>
              </div>
              <div className="panel">
                <div className="panel__header">
                  <span className="panel__title">Flags</span>
                </div>
                <div className="panel__content">
                  <p className="font-mono text-lg text-primary">
                    {data.access.flags.length}
                  </p>
                </div>
              </div>
              <div className="panel">
                <div className="panel__header">
                  <span className="panel__title">Active Overrides</span>
                </div>
                <div className="panel__content">
                  <p className="font-mono text-lg text-primary">
                    {overrides.length}
                  </p>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel__header">
                <span className="panel__title">Entitlements</span>
              </div>
              <div className="panel__content">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {data.access.entitlements.map((entitlement) => (
                    <div
                      key={entitlement.key}
                      className="flex items-center justify-between gap-4 rounded-sm border border-border-dim px-3 py-2"
                    >
                      <div>
                        <p className="font-mono text-xs text-primary">
                          {entitlement.key}
                        </p>
                        <p className="text-[10px] text-tertiary uppercase tracking-wider">
                          source: {entitlement.source}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {entitlement.limit !== null && (
                          <span className="font-mono text-[10px] text-secondary">
                            limit: {entitlement.limit}
                          </span>
                        )}
                        <span
                          className={`badge ${
                            entitlement.enabled
                              ? "badge--nominal"
                              : "badge--neutral"
                          }`}
                        >
                          {entitlement.enabled ? "enabled" : "disabled"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel__header">
                <span className="panel__title">Tenant Feature Flags</span>
              </div>
              <div className="panel__content space-y-3">
                {error && (
                  <div className="flex items-center gap-2 p-2 bg-critical-bg border border-critical-dim rounded-sm">
                    <span className="status-dot status-dot--critical shrink-0" />
                    <span className="text-xs text-critical">{error}</span>
                  </div>
                )}
                {data.access.flags.map((flag) => {
                  const overridden = hasOverride(flag.key);
                  const busy = busyFlagKey === flag.key;

                  return (
                    <div
                      key={flag.key}
                      className="rounded-sm border border-border-dim px-4 py-3"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-sm text-primary">
                              {flag.key}
                            </span>
                            <span className="badge badge--neutral">
                              {flag.definition.flagType}
                            </span>
                            <span
                              className={`badge ${
                                flag.enabled
                                  ? "badge--nominal"
                                  : "badge--critical"
                              }`}
                            >
                              {flag.enabled ? "enabled" : "disabled"}
                            </span>
                            {overridden && (
                              <span className="badge badge--data">override</span>
                            )}
                          </div>
                          <p className="text-xs text-secondary mt-1 leading-relaxed">
                            {flag.definition.description}
                          </p>
                          <div className="flex flex-wrap items-center gap-3 mt-2">
                            <span className="text-[10px] text-tertiary uppercase tracking-wider">
                              source: {flag.source}
                            </span>
                            <span className="text-[10px] text-tertiary uppercase tracking-wider">
                              owner: {flag.definition.owner}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => toggleFlag(flag.key, !flag.enabled)}
                            className={`btn btn--sm ${
                              flag.enabled ? "btn--secondary" : "btn--primary"
                            } disabled:opacity-40`}
                          >
                            {busy
                              ? "Saving..."
                              : flag.enabled
                                ? "Disable"
                                : "Enable"}
                          </button>
                          <button
                            type="button"
                            disabled={!overridden || busy}
                            onClick={() => resetFlag(flag.key)}
                            className="btn btn--ghost btn--sm disabled:opacity-40"
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
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
  const [featureTenant, setFeatureTenant] = useState<Tenant | null>(null);
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
      {featureTenant && (
        <FeatureFlagsModal
          envId={envId}
          tenant={featureTenant}
          onClose={() => setFeatureTenant(null)}
        />
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
            <Input
              type="text"
              search
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="font-mono text-xs py-1.5 w-40"
            />
            <Button onClick={() => setShowCreateOrg(true)} variant="primary" size="sm" className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              Create Org
            </Button>
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
              <Button onClick={() => mutate()} size="sm" className="shrink-0">Retry</Button>
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
                    <div className="flex items-center justify-end gap-2">
                      <button
                        className="btn btn--ghost btn--sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFeatureTenant(tenant);
                        }}
                      >
                        Flags
                      </button>
                      <button
                        className="btn btn--secondary btn--sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedTenant(tenant);
                          setInviteTenant(tenant);
                        }}
                      >
                        Invite
                      </button>
                    </div>
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
