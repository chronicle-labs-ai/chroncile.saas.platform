import type { ReactNode } from "react";
import type { TeamInvitation, TeamMember } from "ui";

/*
 * Helpers for the Team Settings client. Kept colocated with the page
 * so they're trivially testable and don't pollute the design system.
 */

export function errorMessage(code: string | undefined): string {
  switch (code) {
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
 * Pending intent for the destructive ConfirmModal. Stored as a
 * discriminated union so the same modal renders the right copy for
 * each of the three reachable states (remove member, leave workspace,
 * revoke invitation) without duplicating the markup.
 */
export type PendingAction =
  | { kind: "remove"; member: TeamMember }
  | { kind: "leave"; member: TeamMember }
  | { kind: "revoke"; invitation: TeamInvitation }
  | null;

export interface ConfirmCopy {
  title: string;
  message: ReactNode;
  confirmText: string;
  variant: "default" | "danger";
}

const EMPTY_CONFIRM: ConfirmCopy = {
  title: "",
  message: "",
  confirmText: "Confirm",
  variant: "default",
};

function fullName(m: TeamMember): string {
  const name = [m.firstName, m.lastName].filter(Boolean).join(" ");
  return name || m.email || m.userId;
}

export function getConfirmCopy(
  pending: PendingAction,
  orgName: string | null | undefined,
): ConfirmCopy {
  if (!pending) return EMPTY_CONFIRM;
  if (pending.kind === "leave") {
    return {
      title: "Leave this workspace?",
      message: (
        <>
          You&rsquo;ll lose access to {orgName ?? "this workspace"}{" "}
          immediately. An admin will need to invite you back.
        </>
      ),
      confirmText: "Leave workspace",
      variant: "danger",
    };
  }
  if (pending.kind === "remove") {
    return {
      title: `Remove ${fullName(pending.member)}?`,
      message: (
        <>
          They&rsquo;ll lose access to {orgName ?? "this workspace"}{" "}
          immediately.
        </>
      ),
      confirmText: "Remove member",
      variant: "danger",
    };
  }
  return {
    title: "Revoke this invitation?",
    message: (
      <>
        The link sent to{" "}
        <span className="font-mono text-ink-hi">
          {pending.invitation.email}
        </span>{" "}
        will stop working. They can be invited again later.
      </>
    ),
    confirmText: "Revoke invitation",
    variant: "danger",
  };
}
