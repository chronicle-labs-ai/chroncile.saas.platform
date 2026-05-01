"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface Member {
  id: string;
  userId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: { slug: string | null };
  status: "active" | "inactive";
  isOwner: boolean;
  isSelf: boolean;
  createdAt: string;
}

interface MembersResponse {
  members: Member[];
  ownerUserId: string | null;
}

interface Invitation {
  id: string;
  email: string;
  state: "pending" | "accepted" | "expired" | "revoked";
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

interface InvitationsResponse {
  invitations: Invitation[];
}

const ROLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "admin", label: "Admin" },
  { value: "member", label: "Member" },
  { value: "viewer", label: "Viewer" },
];

function fullName(m: Member): string {
  const name = [m.firstName, m.lastName].filter(Boolean).join(" ");
  return name || m.email || m.userId;
}

function errorMessage(error: string | undefined): string {
  switch (error) {
    case "last_admin":
      return "There must be at least one admin in the workspace.";
    case "cannot_change_owner_role":
      return "The workspace owner's role can't be changed here.";
    case "cannot_remove_owner":
      return "The workspace owner can't be removed.";
    case "owner_cannot_leave":
      return "Owners can't leave a workspace. Transfer ownership or delete it.";
    case "forbidden":
      return "You don't have permission to do this.";
    default:
      return "Something went wrong. Try again.";
  }
}

export interface TeamSettingsClientProps {
  orgName?: string | null;
  orgSlug?: string | null;
}

export function TeamSettingsClient({
  orgName,
  orgSlug,
}: TeamSettingsClientProps = {}) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [invitations, setInvitations] = useState<Invitation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviteError, setInviteError] = useState<string | null>(null);

  const refreshMembers = useCallback(async () => {
    try {
      const res = await fetch("/api/org/members", {
        headers: { "cache-control": "no-store" },
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string; detail?: string; required?: string }
          | null;
        const code = data?.error ?? "unknown";
        const detail = data?.detail ? ` — ${data.detail}` : "";
        const required = data?.required ? ` (need: ${data.required})` : "";
        setError(`Failed to load members [${res.status} ${code}${required}]${detail}`);
        setMembers([]);
        return;
      }
      const data = (await res.json()) as MembersResponse;
      setMembers(data.members);
      setError(null);
    } catch (err) {
      setError(
        `Network error loading members${
          err instanceof Error ? ` (${err.message})` : ""
        }.`,
      );
      setMembers([]);
    }
  }, []);

  const refreshInvitations = useCallback(async () => {
    try {
      const res = await fetch("/api/org/invitations", {
        headers: { "cache-control": "no-store" },
      });
      if (!res.ok) {
        setInvitations([]);
        return;
      }
      const data = (await res.json()) as InvitationsResponse;
      setInvitations(
        data.invitations.filter(
          (i) => i.state === "pending" || i.state === "expired",
        ),
      );
    } catch {
      setInvitations([]);
    }
  }, []);

  useEffect(() => {
    refreshMembers();
    refreshInvitations();
  }, [refreshMembers, refreshInvitations]);

  const submitInvite = async () => {
    setInviteError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/org/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, roleSlug: inviteRole }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setInviteError(errorMessage(data?.error));
        return;
      }
      setInviteEmail("");
      setInviteRole("member");
      setShowInvite(false);
      await refreshInvitations();
    } finally {
      setBusy(false);
    }
  };

  const updateRole = async (membership: Member, newSlug: string) => {
    if (newSlug === (membership.role?.slug ?? "")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/org/members/${membership.id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleSlug: newSlug }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(errorMessage(data?.error));
        return;
      }
      setError(null);
      await refreshMembers();
    } finally {
      setBusy(false);
    }
  };

  const removeMember = async (membership: Member) => {
    const verb = membership.isSelf ? "leave this workspace" : `remove ${fullName(membership)}`;
    if (!confirm(`Are you sure you want to ${verb}?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/org/members/${membership.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(membership.isSelf ? { mode: "leave" } : {}),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(errorMessage(data?.error));
        return;
      }
      setError(null);
      await refreshMembers();
    } finally {
      setBusy(false);
    }
  };

  const resendInvite = async (id: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/org/invitations/${id}/resend`, { method: "POST" });
      if (!res.ok) {
        setError("Failed to resend invitation.");
        return;
      }
      setError(null);
      await refreshInvitations();
    } finally {
      setBusy(false);
    }
  };

  const revokeInvite = async (id: string) => {
    if (!confirm("Revoke this invitation?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/org/invitations/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setError("Failed to revoke invitation.");
        return;
      }
      setError(null);
      await refreshInvitations();
    } finally {
      setBusy(false);
    }
  };

  const sortedMembers = useMemo(
    () =>
      members
        ? [...members].sort((a, b) => {
            if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1;
            return (a.email ?? "").localeCompare(b.email ?? "");
          })
        : null,
    [members],
  );

  return (
    <div className="space-y-10">
      <header className="flex items-start justify-between gap-6">
        <div>
          <div className="text-xs uppercase tracking-wide text-neutral-500">
            Workspace
          </div>
          <div className="mt-1 flex items-baseline gap-3">
            <h1 className="text-xl font-semibold text-neutral-100">
              {orgName ?? "—"}
            </h1>
            {orgSlug ? (
              <span className="font-mono text-xs text-neutral-500">
                /{orgSlug}
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-sm text-neutral-400">
            Manage who can access this workspace.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowInvite(true)}
          className="rounded-md bg-orange-600 px-4 py-2 text-sm text-white hover:bg-orange-500"
        >
          + Invite member
        </button>
      </header>

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-red-700/40 bg-red-700/10 px-3 py-2 text-sm text-red-300"
        >
          {error}
        </div>
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-medium text-neutral-300">Members</h2>
        <div className="overflow-hidden rounded-md border border-neutral-800">
          <table className="min-w-full divide-y divide-neutral-800 text-sm">
            <thead className="bg-neutral-900 text-neutral-400">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Member</th>
                <th className="px-4 py-2 text-left font-medium">Role</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {sortedMembers === null ? (
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-neutral-500">
                    Loading…
                  </td>
                </tr>
              ) : sortedMembers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-neutral-500">
                    No members in this workspace.
                  </td>
                </tr>
              ) : (
                sortedMembers.map((m) => (
                  <tr key={m.id} className="bg-neutral-950">
                    <td className="px-4 py-3 align-top">
                      <div className="text-neutral-100">{fullName(m)}</div>
                      {m.email && fullName(m) !== m.email ? (
                        <div className="text-xs text-neutral-500">{m.email}</div>
                      ) : null}
                      <div className="mt-1 flex gap-1">
                        {m.isOwner ? (
                          <span className="inline-block rounded-full border border-orange-500/40 bg-orange-500/10 px-2 py-[1px] text-xs uppercase tracking-wide text-orange-300">
                            owner
                          </span>
                        ) : null}
                        {m.isSelf ? (
                          <span className="inline-block rounded-full border border-neutral-700 px-2 py-[1px] text-xs uppercase tracking-wide text-neutral-400">
                            you
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        disabled={busy || m.isOwner}
                        value={m.role?.slug ?? "member"}
                        onChange={(e) => updateRole(m, e.target.value)}
                        className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-100 disabled:opacity-50"
                      >
                        {ROLE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-neutral-300">{m.status}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={busy || m.isOwner}
                        onClick={() => removeMember(m)}
                        className="text-red-400 hover:underline disabled:opacity-50"
                      >
                        {m.isSelf ? "Leave" : "Remove"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-neutral-300">
          Pending invitations
        </h2>
        <div className="overflow-hidden rounded-md border border-neutral-800">
          <table className="min-w-full divide-y divide-neutral-800 text-sm">
            <thead className="bg-neutral-900 text-neutral-400">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Email</th>
                <th className="px-4 py-2 text-left font-medium">State</th>
                <th className="px-4 py-2 text-left font-medium">Expires</th>
                <th className="px-4 py-2 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {invitations === null ? (
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-neutral-500">
                    Loading…
                  </td>
                </tr>
              ) : invitations.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-neutral-500">
                    No pending invitations.
                  </td>
                </tr>
              ) : (
                invitations.map((inv) => (
                  <tr key={inv.id} className="bg-neutral-950">
                    <td className="px-4 py-3 text-neutral-100">{inv.email}</td>
                    <td className="px-4 py-3 text-neutral-300">{inv.state}</td>
                    <td className="px-4 py-3 text-neutral-400">
                      {new Date(inv.expiresAt).toLocaleDateString()}
                    </td>
                    <td className="space-x-3 px-4 py-3">
                      {inv.state === "pending" ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => resendInvite(inv.id)}
                          className="text-neutral-200 hover:underline"
                        >
                          Resend
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => revokeInvite(inv.id)}
                        className="text-red-400 hover:underline"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showInvite ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => !busy && setShowInvite(false)}
        >
          <div
            className="w-full max-w-md rounded-md border border-neutral-700 bg-neutral-950 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-neutral-100">
              Invite a teammate
            </h3>
            <p className="mt-1 text-sm text-neutral-400">
              They&rsquo;ll get an email with a 7-day acceptance link.
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="block text-neutral-300">Email</span>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100"
                />
              </label>
              <label className="block text-sm">
                <span className="block text-neutral-300">Role</span>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100"
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {inviteError ? (
              <p role="alert" className="mt-3 text-sm text-red-400">
                {inviteError}
              </p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setShowInvite(false)}
                className="rounded-md border border-neutral-700 px-4 py-2 text-sm hover:border-neutral-600"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || !inviteEmail.trim()}
                onClick={submitInvite}
                className="rounded-md bg-orange-600 px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {busy ? "Sending…" : "Send invitation"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
