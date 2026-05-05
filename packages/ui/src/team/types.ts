/*
 * Team — shared types for workspace member + invitation surfaces.
 *
 * The shapes mirror what `/api/org/members` and `/api/org/invitations`
 * return today. They live here (not in the app) so the table primitives
 * can render directly without the app having to massage data first.
 */

export type TeamRoleSlug = "admin" | "member" | "viewer";

export interface TeamRoleOption {
  /** Slug stored on the membership (`admin`, `member`, `viewer`). */
  value: TeamRoleSlug;
  /** Capitalised label for the dropdown. */
  label: string;
}

export interface TeamMember {
  id: string;
  userId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: { slug: string | null };
  status: "active" | "inactive";
  isOwner: boolean;
  /** True when this membership is the currently signed-in user. */
  isSelf: boolean;
  createdAt: string;
}

export type TeamInvitationState =
  | "pending"
  | "accepted"
  | "expired"
  | "revoked";

export interface TeamInvitation {
  id: string;
  email: string;
  state: TeamInvitationState;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface TeamInviteFieldErrors {
  email?: string | null;
}
