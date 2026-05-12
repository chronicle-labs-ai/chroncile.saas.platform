import type { Dictionary } from "./types";

/*
 * Workspace setup (onboarding) + permissions error codes.
 * Emitted by `app/api/onboarding/workspace`, `app/api/auth/switch-org`,
 * and the per-route auth guards.
 */
export const workspaceErrorMessages: Dictionary = {
  workspace_name_required: {
    message: "Pick a workspace name (at least 2 characters).",
    field: "orgName",
  },
  workspace_slug_required: {
    message:
      "Pick a workspace URL — lowercase letters, numbers, and hyphens only.",
    field: "slug",
  },
  invalid_org_name: {
    message: "Pick a workspace name between 2 and 60 characters.",
    field: "orgName",
  },
  invalid_slug: {
    message: "Lowercase letters, numbers, and hyphens only.",
    field: "slug",
  },
  slug_taken: {
    message: "That URL is already in use. Try another.",
    field: "slug",
  },
  slug_already_in_use: {
    message: "That URL is already in use. Try another.",
    field: "slug",
  },
  org_slug_conflict: {
    message: "That URL is already in use. Try another.",
    field: "slug",
  },
  duplicate_slug: {
    message: "That URL is already in use. Try another.",
    field: "slug",
  },
  org_name_already_exists: {
    message: "That workspace name is already in use.",
    field: "orgName",
  },
  name_taken: {
    message: "That workspace name is already in use.",
    field: "orgName",
  },
  duplicate_org_name: {
    message: "That workspace name is already in use.",
    field: "orgName",
  },
  workspace_provisioning_failed: {
    message: "We couldn't create your workspace. Try again.",
    recoverable: true,
  },
  tenant_registration_failed: {
    message: "We couldn't register your workspace. Try again.",
    recoverable: true,
  },
  admin_role_not_configured: {
    message:
      "Your workspace couldn't be set up correctly. Contact support so we can fix it on our end.",
  },
  session_refresh_failed: {
    message:
      "We couldn't switch you into your new workspace. Try refreshing the page.",
    recoverable: true,
  },
  session_missing_after_provisioning: {
    message: "Your session ended unexpectedly. Sign in again.",
  },

  // Permissions / authorization.
  unauthenticated: {
    message: "Please sign in to continue.",
  },
  forbidden: {
    message: "You don't have permission to do that.",
  },
  not_a_member: {
    message: "You're not a member of that workspace.",
  },
};
