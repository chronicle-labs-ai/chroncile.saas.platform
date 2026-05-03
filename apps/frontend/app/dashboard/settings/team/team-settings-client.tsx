"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  ConfirmModal,
  Eyebrow,
  FormField,
  Input,
  Modal,
  NativeSelect,
} from "ui";

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

/*
 * Pending intent for the destructive ConfirmModal. Stored as
 * discriminated union so the same modal renders the right copy
 * for each of the three reachable states (remove member, leave
 * workspace, revoke invitation) without duplicating the markup.
 */
type PendingAction =
  | { kind: "remove"; member: Member }
  | { kind: "leave"; member: Member }
  | { kind: "revoke"; invitation: Invitation }
  | null;

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
  const [inviteEmailError, setInviteEmailError] = useState<string | null>(null);

  const [pending, setPending] = useState<PendingAction>(null);

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
    setInviteEmailError(null);
    const email = inviteEmail.trim();
    if (!email) {
      setInviteEmailError("Enter the teammate's email");
      return;
    }
    /*
     * Cheap regex — server is the source of truth, this just spares
     * one round-trip for obvious mistakes.
     */
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInviteEmailError("That email doesn't look right");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/org/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, roleSlug: inviteRole }),
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

  const performRemove = async (membership: Member) => {
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
      setPending(null);
    }
  };

  const performRevoke = async (id: string) => {
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
      setPending(null);
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

  const closeInvite = () => {
    if (busy) return;
    setShowInvite(false);
    setInviteError(null);
    setInviteEmailError(null);
  };

  /*
   * Confirm copy is centralised so each branch reads the same way
   * across title / message / button label.
   */
  const confirmCopy = (() => {
    if (!pending) {
      return {
        title: "",
        message: "",
        confirmText: "Confirm",
        variant: "default" as const,
      };
    }
    if (pending.kind === "leave") {
      return {
        title: "Leave this workspace?",
        message: (
          <>
            You&rsquo;ll lose access to {orgName ?? "this workspace"} immediately.
            An admin will need to invite you back.
          </>
        ),
        confirmText: "Leave workspace",
        variant: "danger" as const,
      };
    }
    if (pending.kind === "remove") {
      return {
        title: `Remove ${fullName(pending.member)}?`,
        message: (
          <>
            They&rsquo;ll lose access to {orgName ?? "this workspace"} immediately.
          </>
        ),
        confirmText: "Remove member",
        variant: "danger" as const,
      };
    }
    return {
      title: "Revoke this invitation?",
      message: (
        <>
          The link sent to{" "}
          <span className="font-mono text-ink-hi">{pending.invitation.email}</span>{" "}
          will stop working. They can be invited again later.
        </>
      ),
      confirmText: "Revoke invitation",
      variant: "danger" as const,
    };
  })();

  const performPending = () => {
    if (!pending) return;
    if (pending.kind === "revoke") {
      performRevoke(pending.invitation.id);
    } else {
      performRemove(pending.member);
    }
  };

  return (
    <div className="space-y-s-10">
      <header className="flex flex-wrap items-start justify-between gap-s-4">
        <div className="min-w-0">
          <Eyebrow>Workspace</Eyebrow>
          <div className="mt-s-1 flex items-baseline gap-s-3">
            <h1 className="font-sans text-title font-medium tracking-tight text-ink-hi">
              {orgName ?? "—"}
            </h1>
            {orgSlug ? (
              <span className="font-mono text-mono text-ink-dim tabular-nums">
                /{orgSlug}
              </span>
            ) : null}
          </div>
          <p className="mt-s-2 text-body-sm text-ink-lo">
            Manage who can access this workspace.
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          onPress={() => setShowInvite(true)}
          leadingIcon={
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              className="h-4 w-4"
            >
              <path strokeLinecap="round" d="M12 5v14M5 12h14" />
            </svg>
          }
        >
          Invite member
        </Button>
      </header>

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-event-red/30 bg-event-red/10 px-s-3 py-s-2 text-body-sm text-event-red"
        >
          {error}
        </div>
      ) : null}

      <section>
        <h2 className="mb-s-3 font-sans text-body-sm font-medium text-ink-hi">
          Members
        </h2>
        <div className="overflow-hidden rounded-md border border-hairline-strong bg-surface-01">
          <table className="min-w-full divide-y divide-hairline text-body-sm">
            <thead className="bg-surface-02">
              <tr className="text-left text-ink-dim">
                <th className="px-s-4 py-s-2 font-medium">Member</th>
                <th className="px-s-4 py-s-2 font-medium">Role</th>
                <th className="px-s-4 py-s-2 font-medium">Status</th>
                <th className="px-s-4 py-s-2 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {sortedMembers === null ? (
                <tr>
                  <td colSpan={4} className="px-s-4 py-s-3 text-ink-dim">
                    Loading…
                  </td>
                </tr>
              ) : sortedMembers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-s-4 py-s-3 text-ink-dim">
                    No members in this workspace.
                  </td>
                </tr>
              ) : (
                sortedMembers.map((m) => (
                  <tr key={m.id}>
                    <td className="px-s-4 py-s-3 align-top">
                      <div className="text-ink-hi">{fullName(m)}</div>
                      {m.email && fullName(m) !== m.email ? (
                        <div className="text-mono text-ink-dim">{m.email}</div>
                      ) : null}
                      <div className="mt-s-1 flex flex-wrap gap-s-1">
                        {m.isOwner ? (
                          <span className="inline-flex items-center rounded-pill border border-ember/40 bg-ember/10 px-s-2 py-[1px] font-mono text-mono-sm uppercase tracking-eyebrow text-ember">
                            owner
                          </span>
                        ) : null}
                        {m.isSelf ? (
                          <span className="inline-flex items-center rounded-pill border border-hairline-strong px-s-2 py-[1px] font-mono text-mono-sm uppercase tracking-eyebrow text-ink-dim">
                            you
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-s-4 py-s-3 align-middle">
                      <NativeSelect
                        aria-label={`Role for ${fullName(m)}`}
                        disabled={busy || m.isOwner}
                        value={m.role?.slug ?? "member"}
                        onChange={(e) => updateRole(m, e.target.value)}
                        className="w-[120px]"
                      >
                        {ROLE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </NativeSelect>
                    </td>
                    <td className="px-s-4 py-s-3 align-middle text-ink">
                      <span
                        className={
                          m.status === "active"
                            ? "text-ink"
                            : "text-ink-dim"
                        }
                      >
                        {m.status}
                      </span>
                    </td>
                    <td className="px-s-4 py-s-3 align-middle text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        isDisabled={busy || m.isOwner}
                        onPress={() =>
                          setPending(
                            m.isSelf
                              ? { kind: "leave", member: m }
                              : { kind: "remove", member: m },
                          )
                        }
                        className="text-event-red hover:bg-event-red/10 hover:text-event-red"
                      >
                        {m.isSelf ? "Leave" : "Remove"}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-s-3 font-sans text-body-sm font-medium text-ink-hi">
          Pending invitations
        </h2>
        <div className="overflow-hidden rounded-md border border-hairline-strong bg-surface-01">
          <table className="min-w-full divide-y divide-hairline text-body-sm">
            <thead className="bg-surface-02">
              <tr className="text-left text-ink-dim">
                <th className="px-s-4 py-s-2 font-medium">Email</th>
                <th className="px-s-4 py-s-2 font-medium">State</th>
                <th className="px-s-4 py-s-2 font-medium">Expires</th>
                <th className="px-s-4 py-s-2 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {invitations === null ? (
                <tr>
                  <td colSpan={4} className="px-s-4 py-s-3 text-ink-dim">
                    Loading…
                  </td>
                </tr>
              ) : invitations.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-s-4 py-s-3 text-ink-dim">
                    No pending invitations.
                  </td>
                </tr>
              ) : (
                invitations.map((inv) => (
                  <tr key={inv.id}>
                    <td className="px-s-4 py-s-3 text-ink-hi">{inv.email}</td>
                    <td className="px-s-4 py-s-3 text-ink">{inv.state}</td>
                    <td className="px-s-4 py-s-3 tabular-nums text-ink-dim">
                      {new Date(inv.expiresAt).toLocaleDateString()}
                    </td>
                    <td className="px-s-4 py-s-3 text-right">
                      <div className="inline-flex items-center gap-s-1">
                        {inv.state === "pending" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            isDisabled={busy}
                            onPress={() => resendInvite(inv.id)}
                          >
                            Resend
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="sm"
                          isDisabled={busy}
                          onPress={() =>
                            setPending({ kind: "revoke", invitation: inv })
                          }
                          className="text-event-red hover:bg-event-red/10 hover:text-event-red"
                        >
                          Revoke
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        isOpen={showInvite}
        onClose={closeInvite}
        title="Invite a teammate"
        actions={
          <>
            <Button
              variant="secondary"
              isDisabled={busy}
              onPress={closeInvite}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="invite-form"
              isLoading={busy}
              isDisabled={!inviteEmail.trim()}
            >
              {busy ? "Sending…" : "Send invitation"}
            </Button>
          </>
        }
      >
        {/*
         * `<form>` lets the browser submit on Enter from any input
         * and gives Cmd+Enter the same behaviour for free. The
         * footer's Send button is hoisted out of the form via
         * `form="invite-form"` so the visual layout (sticky footer
         * row, separated by a hairline) stays intact.
         */}
        <form
          id="invite-form"
          onSubmit={(e) => {
            e.preventDefault();
            submitInvite();
          }}
          className="flex flex-col gap-s-3"
          noValidate
        >
          <p className="text-body-sm text-ink-lo">
            They&rsquo;ll get an email with a 7-day acceptance link.
          </p>
          <FormField
            label="Email"
            htmlFor="invite-email"
            error={inviteError ?? inviteEmailError ?? undefined}
          >
            <Input
              id="invite-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              spellCheck={false}
              autoCapitalize="off"
              value={inviteEmail}
              onChange={(e) => {
                setInviteEmail(e.currentTarget.value);
                if (inviteEmailError) setInviteEmailError(null);
                if (inviteError) setInviteError(null);
              }}
              placeholder="teammate@company.com"
              invalid={!!inviteEmailError}
              data-1p-ignore
              data-lpignore="true"
              /*
               * Auto-focusing inside a modal is the right move on
               * desktop (Emil's rule), but on touch it pops the
               * keyboard before the user has parsed the dialog. We
               * gate it on `pointer:fine` via the inline check below.
               */
              autoFocus={
                typeof window !== "undefined" &&
                window.matchMedia?.("(pointer: fine)").matches
              }
            />
          </FormField>
          <FormField label="Role" htmlFor="invite-role">
            <NativeSelect
              id="invite-role"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.currentTarget.value)}
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={pending !== null}
        onClose={() => {
          if (busy) return;
          setPending(null);
        }}
        onConfirm={performPending}
        title={confirmCopy.title}
        message={confirmCopy.message}
        confirmText={confirmCopy.confirmText}
        variant={confirmCopy.variant}
        isLoading={busy}
      />
    </div>
  );
}
