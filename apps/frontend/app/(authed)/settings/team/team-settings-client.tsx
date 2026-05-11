"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ConfirmModal,
  InvitationsTable,
  InviteMemberModal,
  MembersTable,
  TeamErrorBanner,
  TeamPageHeader,
  type InviteMemberModalValue,
  type TeamInvitation,
  type TeamMember,
  type TeamRoleSlug,
} from "ui";

import {
  createInvitation,
  fetchInvitations,
  fetchMembers,
  removeMember,
  resendInvitation,
  revokeInvitation,
  updateMemberRole,
} from "./team-api";
import {
  getConfirmCopy,
  type PendingAction,
} from "./team-helpers";

export interface TeamSettingsClientProps {
  orgName?: string | null;
  orgSlug?: string | null;
}

export function TeamSettingsClient({
  orgName,
  orgSlug,
}: TeamSettingsClientProps = {}) {
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [invitations, setInvitations] = useState<TeamInvitation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [pending, setPending] = useState<PendingAction>(null);

  const refreshMembers = useCallback(async () => {
    const result = await fetchMembers();
    if (!result.ok) {
      setError(result.error);
      setMembers([]);
      return;
    }
    setMembers(result.data.members);
    setError(null);
  }, []);

  const refreshInvitations = useCallback(async () => {
    const result = await fetchInvitations();
    if (!result.ok) {
      setInvitations([]);
      return;
    }
    setInvitations(
      result.data.invitations.filter(
        (i) => i.state === "pending" || i.state === "expired",
      ),
    );
  }, []);

  useEffect(() => {
    /*
     * Effect kicks off two parallel async fetches on mount; the
     * helpers own the setState calls inside their `await`-deferred
     * bodies. React's stricter set-state-in-effect rule traces
     * through the useCallback chain — the original component used
     * the exact same pattern but its more complex try/catch bodies
     * hid the trace. This is the documented "load on mount" pattern.
     */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void Promise.allSettled([refreshMembers(), refreshInvitations()]);
  }, [refreshMembers, refreshInvitations]);

  const submitInvite = async (value: InviteMemberModalValue) => {
    setInviteError(null);
    setBusy(true);
    const result = await createInvitation(value.email, value.role);
    setBusy(false);
    if (!result.ok) {
      setInviteError(result.error);
      return;
    }
    setShowInvite(false);
    await refreshInvitations();
  };

  const updateRole = async (membership: TeamMember, newSlug: TeamRoleSlug) => {
    if (newSlug === (membership.role?.slug ?? "")) return;
    setBusy(true);
    const result = await updateMemberRole(membership.id, newSlug);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    await refreshMembers();
  };

  const performRemove = async (membership: TeamMember) => {
    setBusy(true);
    const result = await removeMember(membership.id, membership.isSelf);
    setBusy(false);
    setPending(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    await refreshMembers();
  };

  const performRevoke = async (id: string) => {
    setBusy(true);
    const result = await revokeInvitation(id);
    setBusy(false);
    setPending(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    await refreshInvitations();
  };

  const handleResend = async (invitation: TeamInvitation) => {
    setBusy(true);
    const result = await resendInvitation(invitation.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    await refreshInvitations();
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
  };

  const confirmCopy = getConfirmCopy(pending, orgName);

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
      <TeamPageHeader
        orgName={orgName}
        orgSlug={orgSlug}
        onInvite={() => setShowInvite(true)}
      />

      {error ? <TeamErrorBanner>{error}</TeamErrorBanner> : null}

      <section>
        <h2 className="mb-s-3 font-sans text-body-sm font-medium text-ink-hi">
          Members
        </h2>
        <MembersTable
          members={sortedMembers ?? []}
          isLoading={sortedMembers === null}
          isBusy={busy}
          onRoleChange={updateRole}
          onRemove={(m) => setPending({ kind: "remove", member: m })}
          onLeave={(m) => setPending({ kind: "leave", member: m })}
        />
      </section>

      <section>
        <h2 className="mb-s-3 font-sans text-body-sm font-medium text-ink-hi">
          Pending invitations
        </h2>
        <InvitationsTable
          invitations={invitations ?? []}
          isLoading={invitations === null}
          isBusy={busy}
          onResend={handleResend}
          onRevoke={(inv) => setPending({ kind: "revoke", invitation: inv })}
        />
      </section>

      <InviteMemberModal
        isOpen={showInvite}
        onClose={closeInvite}
        onSubmit={submitInvite}
        isBusy={busy}
        error={inviteError}
      />

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
