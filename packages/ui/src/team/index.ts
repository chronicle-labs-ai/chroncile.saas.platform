/*
 * Team — workspace member + invitation surfaces.
 *
 * The package mirrors `agents/`, `datasets/`, and `connections/`:
 * presentational primitives that the application composes with its
 * own fetch + state. The Team Settings page in `apps/frontend` wires
 * `/api/org/members` and `/api/org/invitations` through these
 * components without owning any visual concerns.
 */

export { TeamPageHeader } from "./team-page-header";
export type { TeamPageHeaderProps } from "./team-page-header";

export { TeamErrorBanner } from "./team-error-banner";
export type { TeamErrorBannerProps } from "./team-error-banner";

export { MembersTable } from "./members-table";
export type { MembersTableProps } from "./members-table";

export { InvitationsTable } from "./invitations-table";
export type { InvitationsTableProps } from "./invitations-table";

export { InviteMemberModal } from "./invite-member-modal";
export type {
  InviteMemberModalProps,
  InviteMemberModalValue,
} from "./invite-member-modal";

export type {
  TeamInvitation,
  TeamInvitationState,
  TeamInviteFieldErrors,
  TeamMember,
  TeamRoleOption,
  TeamRoleSlug,
} from "./types";
